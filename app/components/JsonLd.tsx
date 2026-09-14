/**
 * Renders one or more JSON-LD objects as a single script tag.
 *
 * The markup is serialized with `JSON.stringify` and the `<` character is
 * escaped so a JSON-LD payload can never break out of the script element.
 */
export default function JsonLd({
  data,
}: {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
}) {
  const payload = Array.isArray(data) ? data : [data];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(payload).replace(/</g, "\\u003c"),
      }}
    />
  );
}
