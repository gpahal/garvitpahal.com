import type { PostDetails } from "~lib/post";

type PostSeriesTOCProps = {
  post: PostDetails;
};

export default function PostSeriesTOC({ post }: PostSeriesTOCProps) {
  if (!post.children || post.children.length === 0) {
    return null;
  }

  return (
    <ul>
      {post.children.reverse().map((child) => {
        return (
          <li key={child.slug}>
            <a href={`/blog/${child.slug}`}>
              <span>{child.frontmatter.title}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
