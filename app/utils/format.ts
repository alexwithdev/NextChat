export function prettyObject(msg: any) {
  const obj = msg;
  if (typeof msg !== "string") {
    msg = JSON.stringify(msg, null, "  ");
  }
  if (msg === "{}") {
    return obj.toString();
  }
  if (msg.startsWith("```json")) {
    return msg;
  }
  return ["```json", msg, "```"].join("\n");
}

export function* chunks(s: string, maxBytes = 1000 * 1000) {
  const decoder = new TextDecoder("utf-8");
  let buf = new TextEncoder().encode(s);

  while (buf.length) {
    let i = Math.min(maxBytes, buf.length);
    // Find last valid UTF-8 boundary within maxBytes
    while (i > 0 && (buf[i] & 0xC0) === 0x80) {
      i--;
    }
    // If all bytes are consecutive (such as damaged data), take at least 1 byte
    if (i === 0) i = Math.min(1, buf.length);

    yield decoder.decode(buf.slice(0, i));
    buf = buf.slice(i);
  }
}
