import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode, RefObject } from 'react'

import { CheckIcon, TriangleAlertIcon, TypeIcon } from 'lucide-react'

import {
  categoryLabel,
  familyName,
  familyValue,
  firstFamily,
  fontCategories,
  fontKey,
  loadFontList,
  previewSource,
  readStoredFont,
  searchFonts,
  writeStoredFont,
} from '@/lib/font-tester'
import type { FontList, TesterFont } from '@/lib/font-tester'
import { useGrowingLimit } from '@/hooks/use-growing-limit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'

/**
 * The catalogue runs to thousands of fonts, each row with its own observer.
 */
const RESULTS_STEP = 100

/**
 * Once per page load; a failure is forgotten so a retry fetches again.
 */
const fontList: { request?: Promise<FontList> } = {}

/**
 * `document.fonts` outlives the island and navigation, so each face is added once. A failed face
 * keeps rejecting `load()`, so it is replaced when next asked for.
 */
const addedFaces = new Map<string, FontFace>()

function addFace(family: string, source: TesterFont['faces'][number]): FontFace {
  const key = `${family} ${source.weight} ${source.style}`
  let face = addedFaces.get(key)
  if (face?.status === 'error') {
    document.fonts.delete(face)
    addedFaces.delete(key)
    face = undefined
  }
  if (!face) {
    face = new FontFace(family, `url("${source.url}") format("woff2")`, {
      weight: String(source.weight),
      style: source.style,
    })
    document.fonts.add(face)
    addedFaces.set(key, face)
  }
  return face
}

/**
 * A dev-only widget that swaps the site's sans font. The override is an unlayered rule, which beats
 * every Tailwind layer without `!important`.
 */
export function FontTester({ fontshareFontsPath }: { fontshareFontsPath: string }): ReactNode {
  // Read before the override first renders, so it names the site's own font.
  const [defaultFontFamily] = useState(() => getComputedStyle(document.documentElement).fontFamily)
  const defaultName = firstFamily(defaultFontFamily) ?? 'Default font'
  const [selected, setSelected] = useState(readStoredFont)
  const [loadError, setLoadError] = useState<string>()
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const [list, setList] = useState<FontList>()

  useEffect(() => {
    if (!isOpen || list) {
      return
    }
    let isCurrent = true
    const load = async () => {
      fontList.request ??= loadFontList(fetch, fontshareFontsPath)
      const next = await fontList.request
      if (next.status === 'error') {
        fontList.request = undefined
      }
      if (isCurrent) {
        setList(next)
      }
    }
    load().catch(globalThis.reportError)
    return () => {
      isCurrent = false
    }
  }, [isOpen, fontshareFontsPath, list])

  // Loads the regular face to learn whether the files can be reached. A new `loadAttempt` loads
  // again, so picking the same font retries it.
  useEffect(() => {
    if (!selected) {
      return
    }
    const family = familyName(selected, 'applied')
    for (const source of selected.faces) {
      addFace(family, source)
    }
    let isCurrent = true
    addFace(family, previewSource(selected))
      .load()
      .catch(() => {
        if (isCurrent) {
          setLoadError(
            `${selected.family} could not be loaded. Check your connection and pick it again`,
          )
        }
      })
    return () => {
      isCurrent = false
    }
  }, [selected, loadAttempt])

  // The popover is portalled into the `body` the swap replaces, so it would vanish while still
  // counted open.
  useEffect(() => {
    const close = (): void => {
      setIsOpen(false)
    }
    document.addEventListener('astro:before-swap', close)
    return () => {
      document.removeEventListener('astro:before-swap', close)
    }
  }, [])

  const choose = (font: TesterFont | undefined): void => {
    setSelected(font)
    setLoadAttempt((attempt) => attempt + 1)
    setLoadError(undefined)
    writeStoredFont(font)
  }

  const name = selected?.family ?? defaultName
  // After a reload the popover is closed and the page has quietly fallen back to a generic family,
  // so the trigger says so too.
  const hasFailed = loadError !== undefined
  return (
    // Above the bottom navigation bar on phones.
    <div className="fixed right-4 bottom-20 z-30 lg:top-4 lg:bottom-auto">
      {selected && (
        <style>{`html, .font-sans, .font-heading { font-family: ${familyValue(selected, 'applied')}; }`}</style>
      )}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger
          render={<Button variant="outline" size="sm" className="rounded-full shadow-sm" />}
          aria-label={
            hasFailed ? `Font tester, ${name} failed to load` : `Font tester, showing ${name}`
          }
        >
          {hasFailed ? (
            <TriangleAlertIcon data-icon="inline-start" className="text-destructive" />
          ) : (
            <TypeIcon data-icon="inline-start" />
          )}
          <span className="max-w-40 truncate">{name}</span>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          initialFocus={searchRef}
          className="w-80 max-w-[calc(100vw-2rem)]"
        >
          <FontPicker
            searchRef={searchRef}
            list={list}
            retry={() => {
              setList(undefined)
            }}
            selected={selected}
            defaultName={defaultName}
            defaultFontFamily={defaultFontFamily}
            loadError={loadError}
            query={query}
            onQueryChange={setQuery}
            category={category}
            onCategoryChange={setCategory}
            onChoose={choose}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

type FontPickerProps = {
  searchRef: RefObject<HTMLInputElement | null>
  list: FontList | undefined
  retry: () => void
  selected: TesterFont | undefined
  defaultName: string
  defaultFontFamily: string
  loadError: string | undefined
  query: string
  onQueryChange: (query: string) => void
  /**
   * Empty for every category.
   */
  category: string
  onCategoryChange: (category: string) => void
  /**
   * `undefined` reverts to the site's default font.
   */
  onChoose: (font: TesterFont | undefined) => void
}

type PickerOption = { key: string; font: TesterFont | undefined }

function FontPicker({
  searchRef,
  list,
  retry,
  selected,
  defaultName,
  defaultFontFamily,
  loadError,
  query,
  onQueryChange,
  category,
  onCategoryChange,
  onChoose,
}: FontPickerProps): ReactNode {
  const listId = useId()
  const errorId = useId()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const fonts = useMemo(() => (list?.status === 'ready' ? list.fonts : []), [list])
  const categories = useMemo(() => fontCategories(fonts), [fonts])
  const results = useMemo(() => searchFonts(fonts, query, category), [fonts, query, category])
  const growing = useGrowingLimit(`${category}\n${query}`, {
    step: RESULTS_STEP,
    max: results.length,
  })
  const isDefaultListed = query.trim() === '' && category === ''
  const options: Array<PickerOption> = [
    ...(isDefaultListed ? [{ key: 'default', font: undefined }] : []),
    ...results.slice(0, growing.limit).map((font) => ({ key: fontKey(font), font })),
  ]
  const active = Math.min(activeIndex, options.length - 1)
  const optionId = (index: number): string => `${listId}-${index}`

  useEffect(() => {
    scrollRef.current?.querySelector('[data-active=true]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (options.length === 0) {
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      if (step === 1 && active === options.length - 1 && growing.canGrow) {
        // Past the last row, as "Show more" would, so the keyboard need not leave the search field.
        growing.grow()
        setActiveIndex(active + 1)
      } else {
        setActiveIndex(Math.min(Math.max(active + step, 0), options.length - 1))
      }
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const option = options[active]
      if (option) {
        onChoose(option.font)
      }
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <PopoverTitle>Font tester</PopoverTitle>
        <Button
          variant="ghost"
          size="xs"
          disabled={!selected}
          onClick={() => {
            onChoose(undefined)
          }}
        >
          Revert to default
        </Button>
      </div>
      {loadError !== undefined && (
        <p id={errorId} role="alert" className="text-destructive">
          {loadError}
        </p>
      )}
      <div className="flex gap-2">
        <Input
          ref={searchRef}
          role="combobox"
          aria-label="Search fonts"
          aria-expanded={list?.status === 'ready'}
          aria-controls={listId}
          aria-activedescendant={options.length > 0 ? optionId(active) : undefined}
          aria-describedby={loadError !== undefined ? errorId : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder="Search fonts"
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value)
            setActiveIndex(0)
            scrollRef.current?.scrollTo({ top: 0 })
          }}
          onKeyDown={onKeyDown}
        />
        <NativeSelect
          aria-label="Category"
          className="shrink-0"
          value={category}
          onChange={(event) => {
            onCategoryChange(event.target.value)
            setActiveIndex(0)
            scrollRef.current?.scrollTo({ top: 0 })
          }}
        >
          <NativeSelectOption value="">All</NativeSelectOption>
          {categories.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {categoryLabel(value)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      {list === undefined ? (
        <p className="text-muted-foreground">Loading fonts…</p>
      ) : list.status === 'error' ? (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-destructive">
            {list.message}
          </p>
          <Button variant="outline" size="sm" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {results.length === 0
              ? 'No fonts match'
              : `${results.length.toLocaleString('en')} ${results.length === 1 ? 'font' : 'fonts'}`}
          </p>
          {list.notices.map((notice) => (
            <p key={notice} className="text-xs text-muted-foreground">
              {notice}
            </p>
          ))}
          <div ref={scrollRef} className="-mx-1 max-h-[min(24rem,60dvh)] overflow-y-auto px-1">
            <div id={listId} role="listbox" aria-label="Fonts">
              {options.map((option, index) => (
                <FontOption
                  key={option.key}
                  id={optionId(index)}
                  font={option.font}
                  defaultName={defaultName}
                  defaultFontFamily={defaultFontFamily}
                  isActive={index === active}
                  isApplied={
                    option.font === undefined
                      ? selected === undefined
                      : selected !== undefined && fontKey(option.font) === fontKey(selected)
                  }
                  scrollRef={scrollRef}
                  onChoose={() => {
                    setActiveIndex(index)
                    onChoose(option.font)
                  }}
                />
              ))}
            </div>
            {growing.canGrow && (
              <Button variant="outline" size="sm" className="my-2 w-full" onClick={growing.grow}>
                Show more
              </Button>
            )}
          </div>
        </>
      )}
    </>
  )
}

type FontOptionProps = {
  id: string
  /**
   * `undefined` is the site's default font.
   */
  font: TesterFont | undefined
  defaultName: string
  defaultFontFamily: string
  isActive: boolean
  isApplied: boolean
  scrollRef: RefObject<HTMLDivElement | null>
  onChoose: () => void
}

function FontOption({
  id,
  font,
  defaultName,
  defaultFontFamily,
  isActive,
  isApplied,
  scrollRef,
  onChoose,
}: FontOptionProps): ReactNode {
  const ref = useRef<HTMLDivElement>(null)
  // Until a row nears view its `font-family` names no face, so nothing downloads for rows nobody
  // scrolls to.
  const [isNear, setIsNear] = useState(false)
  useEffect(() => {
    const row = ref.current
    if (!font || isNear || !row) {
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.every((entry) => !entry.isIntersecting)) {
          return
        }
        // Here rather than in render, which must not change `document.fonts`.
        addFace(familyName(font, 'preview'), previewSource(font))
        setIsNear(true)
      },
      { root: scrollRef.current, rootMargin: '200px 0px' },
    )
    observer.observe(row)
    return () => {
      observer.disconnect()
    }
  }, [font, isNear, scrollRef])
  return (
    // The search field owns the keyboard through `aria-activedescendant`, so options take no focus.
    // eslint-disable-next-line jsx-a11y-x/click-events-have-key-events -- the search field handles keys
    <div
      ref={ref}
      id={id}
      role="option"
      tabIndex={-1}
      aria-selected={isActive}
      data-active={isActive}
      className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60 data-[active=true]:bg-muted"
      // Keeps focus in the search field.
      onMouseDown={(event) => {
        event.preventDefault()
      }}
      onClick={onChoose}
    >
      <span
        className="min-w-0 flex-1 truncate text-base"
        style={{
          fontFamily: font
            ? isNear
              ? familyValue(font, 'preview')
              : undefined
            : defaultFontFamily,
        }}
      >
        {font ? font.family : defaultName}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {font === undefined
          ? 'Default'
          : font.source === 'fontshare'
            ? `${categoryLabel(font.category)} · Fontshare`
            : categoryLabel(font.category)}
      </span>
      <CheckIcon
        className={isApplied ? 'size-4 shrink-0' : 'invisible size-4 shrink-0'}
        aria-hidden
      />
      {isApplied && <span className="sr-only">, applied</span>}
    </div>
  )
}
