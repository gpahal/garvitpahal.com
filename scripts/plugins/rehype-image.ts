import path from "path";

import { h } from "hastscript";
import sizeOf from "image-size";
import { visit } from "unist-util-visit";

import { isAbsoluteUrl } from "~/lib/url";

import type { Properties } from "hastscript";

function getImageSize(src: string): { src: string; width: number; height: number } | null {
  if (isAbsoluteUrl(src)) {
    return null;
  }
  if (!src.startsWith("/")) {
    throw new Error("Image src should start with a slash");
  }

  src = path.join("public/images", src);
  const { width, height } = sizeOf(src);
  if (typeof width === "undefined" || typeof height === "undefined") {
    throw new Error("Image size could not be calculated");
  }

  return { src: src.slice(6), width, height };
}

function buildFigure(image: { properties?: Properties }) {
  const { properties } = image;
  if (!properties || !properties.src) {
    return;
  }

  const src = String(properties.src);
  const size = getImageSize(src);
  if (size) {
    properties.src = size.src;
    properties.width = size.width;
    properties.height = size.height;
  }

  return h("figure", { class: "figure-wrapper" }, [
    h("img", { ...properties }),
    properties.alt && typeof properties.alt === "string" && properties.alt.trim().length > 0
      ? h("figcaption", properties.alt)
      : "",
  ]);
}

export default function rehypeImage() {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (tree: any) => {
    visit(tree, { tagName: "p" }, (node, index: number | null) => {
      const images = node.children.filter((n: any) => n.tagName === "img").map((image: any) => buildFigure(image));
      if (images.length === 0) {
        return;
      }

      if (!index) {
        throw new Error("Index is null");
      }

      tree.children[index] =
        images.length === 1
          ? images[0]
          : (tree.children[index] = h("div", { class: "figure-wrapper-container" }, images));
    });
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
