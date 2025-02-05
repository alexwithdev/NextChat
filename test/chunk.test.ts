import { chunks } from "../app/utils/format";

describe("Chunk Splitting", () => {
  test("should split string into chunks of specified size", async () => {
    const value = "123456789abcdef";
    let index = 0;
    for await (const _ of chunks(value, 10)) {
      index += 1;
    }
    expect(index).toBe(2);
  });

  test("should join all chunks back to original string", async () => {
    const value = "123456789abcdef";
    const allChunks = []
    for await (const chunk of chunks(value, 10)) {
      allChunks.push(chunk)
    }
    const result = allChunks.join("");
    expect(result).toBe(value);
  });

  test("should handle strings with non-ASCII characters", async () => {
    const value = "12345678测试bcdef";
    const allChunks = []
    for await (const chunk of chunks(value, 10)) {
      allChunks.push(chunk)
    }
    const result = allChunks.join("");
    expect(result).toBe(value);
  });

  test("should handle empty string", async () => {
    const value = "";
    const allChunks = [];
    for await (const chunk of chunks(value, 10)) {
      allChunks.push(chunk);
    }
    const result = allChunks.join("");
    expect(result).toBe(value);
    expect(allChunks.length).toBe(0);
  });

  test("should handle chunk size larger than string length", async () => {
    const value = "12345";
    const allChunks = [];
    for await (const chunk of chunks(value, 10)) {
      allChunks.push(chunk);
    }
    const result = allChunks.join("");
    expect(result).toBe(value);
    expect(allChunks.length).toBe(1);
  });

  test("should handle chunk size of 1", async () => {
    const value = "12345";
    const allChunks = [];
    for await (const chunk of chunks(value, 1)) {
      allChunks.push(chunk);
    }
    const result = allChunks.join("");
    expect(result).toBe(value);
    expect(allChunks.length).toBe(5);
  });

  test("should handle strings with only non-ASCII characters", async () => {
    const value = "测试测试测试";
    const allChunks = [];
    for await (const chunk of chunks(value, 4)) {
      allChunks.push(chunk);
    }
    const result = allChunks.join("");
    expect(result).toBe(value);
    expect(allChunks.length).toBe(6);
  });

  test("should handle strings with non-ASCII characters and chunk size larger than string length", async () => {
    const value = "测试";
    const allChunks = [];
    for await (const chunk of chunks(value, 10)) {
      allChunks.push(chunk);
    }
    const result = allChunks.join("");
    expect(result).toBe(value);
    expect(allChunks.length).toBe(1);
  });

});
