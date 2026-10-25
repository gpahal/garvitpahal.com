import {
  A,
  Blockquote,
  H1,
  H2,
  H3,
  H4,
  Hr,
  InlineCode,
  Ol,
  P,
  Strong,
  Table,
  Td,
  Th,
  Tr,
  Ul,
} from '@/components/shared/typography'

/**
 * `img` is absent because Astro's MDX hands the `img` override an image import instead of a URL,
 * which would replace its optimised `<Image>`.
 */
export const mdxComponents = {
  h1: H1,
  h2: H2,
  h3: H3,
  h4: H4,
  p: P,
  a: A,
  ul: Ul,
  ol: Ol,
  blockquote: Blockquote,
  code: InlineCode,
  table: Table,
  tr: Tr,
  th: Th,
  td: Td,
  hr: Hr,
  strong: Strong,
}
