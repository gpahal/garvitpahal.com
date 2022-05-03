import fs from "fs/promises";
import path from "path";

import { parse } from "date-fns";
import { bundleMDX } from "mdx-bundler";
import calculateReadingTime from "reading-time";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeExternalLinks from "rehype-external-links";
import rehypeSlug from "rehype-slug";
import remarkGFM from "remark-gfm";
import invariant from "tiny-invariant";

import { comparePosts } from "~lib/post";
import { stripPrefix, stripSuffix, trim } from "~lib/string";

import rehypeImage from "./plugins/rehype-image";

import type * as U from "unified";
import type { Post, PostDB, PostFrontmatter, PostIndex, PostIndexInner } from "~lib/post";

const POSTS_PATH = path.join(__dirname, "..", "content", "posts");
const POST_DB_GEN_DIR_PATH = path.join(__dirname, "..", "src", "gen", "content");
const POST_DB_GEN_PAth = path.join(__dirname, "..", "src", "gen", "content", "postDB.json");

function arrayToSlug(slug: string[]): string {
  return slug
    .map((s) => trim(s))
    .filter((s) => s !== "")
    .join("/");
}

function slugToArray(slug: string): string[] {
  return trim(trim(slug), "/")
    .split("/")
    .map((s) => trim(s))
    .filter((s) => s !== "");
}

function walk(dir: string, ext?: string): Promise<string[]> {
  dir = dir.trim();
  return walkInternal(dir, dir, ext ? `.${ext}` : ext);
}

async function walkInternal(dir: string, dirOrig: string, ext?: string): Promise<string[]> {
  const results: string[] = [];
  const files = await fs.readdir(dir);
  await Promise.all(files.map((file) => walkNested(dir, dirOrig, file, results, ext)));
  return results;
}

async function walkNested(dir: string, dirOrig: string, file: string, results: string[], ext?: string) {
  const filepath = path.resolve(dir, file);
  const stat = await fs.stat(filepath);
  if (stat && stat.isDirectory()) {
    results.push(...(await walkInternal(filepath, dirOrig, ext)));
  } else if (!ext || file.endsWith(ext)) {
    results.push(stripPrefix(filepath.trim(), dirOrig));
  }
}

async function generatePosts(): Promise<void> {
  console.log("Creating directory for generated posts...");
  await fs.mkdir(POST_DB_GEN_DIR_PATH, { mode: 0o755, recursive: true });
  const posts = await processPosts();
  await fs.writeFile(POST_DB_GEN_PAth, JSON.stringify(posts), { mode: 0o644 });
}

async function processPosts(): Promise<PostDB> {
  console.log("Processing posts...");
  const postFiles = await walk(POSTS_PATH, "mdx");
  console.log(`\nFound ${postFiles.length} mdx files in ${POSTS_PATH}`);
  const posts: Post[] = [];
  for (const file of postFiles) {
    const post = await compilePost(file);
    posts.push(post);
  }

  posts.sort(comparePosts);

  const postIndex = {};
  for (let i = 0; i < posts.length; i++) {
    setNested(postIndex, posts[i].slugArr, i);
  }

  try {
    validateIndex(postIndex);
  } catch (e: unknown) {
    console.error("Error validating post index");
    throw e;
  }

  return {
    items: posts,
    index: postIndex,
  };
}

function setNested(obj: PostIndex | PostIndexInner, slugArr: string[], postIdx: number) {
  if (slugArr.length === 0) {
    obj.index = postIdx;
    return;
  }

  let curr = slugArr[0];
  const rest = slugArr.slice(1);
  curr = curr.trim();
  if (curr === "") {
    setNested(obj, rest, postIdx);
    return;
  }
  if (curr === "index") {
    throw new Error(`Invalid directory name [index] in slug [${slugArr.join("/")}]`);
  }

  if (!obj[curr]) {
    obj[curr] = {};
  }
  setNested(obj[curr] as PostIndex, rest, postIdx);
}

function validateIndex(postIndex: PostIndex) {
  for (const key of Object.keys(postIndex)) {
    if (key === "index") {
      throw new Error("Invalid index key in first level");
    }

    const value = postIndex[key];
    if (value) {
      if (typeof value !== "object") {
        throw new Error(`Invalid slug value in first level: ${key}`);
      }
      validateIndexInner(value as PostIndexInner);
    }
  }
}

function validateIndexInner(postIndex: PostIndexInner) {
  if (!Object.hasOwn(postIndex, "index")) {
    throw new Error("Missing index key in nested level");
  }

  const indexValue = postIndex.index;
  if (typeof indexValue !== "number" || indexValue < 0) {
    throw new Error(`Invalid index value in nexted level: ${indexValue}`);
  }

  for (const key of Object.keys(postIndex)) {
    if (key === "index") {
      continue;
    }

    const value = postIndex[key];
    if (value) {
      if (typeof value !== "object") {
        throw new Error(`Invalid slug value in nexted level: ${key}`);
      }
      validateIndexInner(value as PostIndex);
    }
  }
}

function parseFrontMatter(frontmatter: { [key: string]: unknown }): PostFrontmatter {
  const { title } = frontmatter;
  invariant(title && typeof title === "string", "Invalid title");

  const { description } = frontmatter;
  invariant(description && typeof description === "string", "Invalid description");

  const { date } = frontmatter;
  invariant(date && typeof date === "string", "Invalid date");

  const tags = frontmatter.tags ?? [];
  invariant(tags && Array.isArray(tags) && tags.every((i) => i && typeof i === "string"), "Invalid tags");

  const { featured } = frontmatter;
  return {
    title,
    description,
    tags,
    publishedTime: parse(date, "dd/MM/yyyy", new Date()).getTime(),
    featured: featured === true || featured === "true",
  };
}

const remarkPlugins: U.PluggableList = [remarkGFM];

const rehypePlugins: U.PluggableList = [
  rehypeSlug,
  [rehypeAutolinkHeadings, { properties: { className: ["anchor"] } }],
  [rehypeExternalLinks, { target: false, rel: ["nofollow", "noopener", "noreferrer"] }],
  rehypeImage,
];

async function compilePost(file: string): Promise<Post> {
  const slugArr = slugToArray(trim(stripSuffix(stripSuffix(file, ".mdx"), "/index")));
  if (slugArr.length == 0) {
    throw new Error(`Slug is empty for file [${file}]`);
  }
  if (slugArr.findIndex((s) => s === "index") >= 0) {
    throw new Error(`Slug has a folder with name "index" [${file}]`);
  }

  const slug = arrayToSlug(slugArr);
  try {
    const source = (await fs.readFile(path.join(POSTS_PATH, file))).toString("utf8");

    const {
      frontmatter,
      code,
      matter: { content },
    } = await bundleMDX({
      source,
      files: {},
      mdxOptions(options) {
        options.remarkPlugins = [...(options.remarkPlugins ?? []), ...remarkPlugins];
        options.rehypePlugins = [...(options.rehypePlugins ?? []), ...rehypePlugins];
        return options;
      },
    });

    const readingTime = calculateReadingTime(content);
    return {
      slugArr,
      slug,
      readingTime,
      code,
      frontmatter: parseFrontMatter(frontmatter),
    };
  } catch (e: unknown) {
    console.error(`Compilation error for slug [${slug}]`);
    throw e;
  }
}

generatePosts();
