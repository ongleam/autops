import { expect, test } from "bun:test";
import { createIssue, getIssue, commentIssue, updateIssue } from "../lib/github/issues";

const connection = { token: "fixture-token", repository: { fullName: "alice/selected" } };
const data = { number: 7, title: "문제 확인", body: "재현과 검증", state: "open", html_url: "https://github.com/alice/selected/issues/7", user: { login: "alice" } };

test("issue mutations use only the verified selected repository and preserve UTF-8", async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    expect(options.headers.Authorization).toBe("Bearer fixture-token");
    if (url.endsWith("/comments")) return Response.json({ id: 3, html_url: `${data.html_url}#issuecomment-3` });
    return Response.json({ ...data, ...(options.method === "PATCH" ? { state: "closed" } : {}) });
  };
  expect(await createIssue(connection, { title: data.title, body: data.body }, fetcher)).toMatchObject({ repository: "alice/selected", number: 7, author: "alice" });
  expect(JSON.parse(calls[0].options.body)).toEqual({ title: data.title, body: data.body });
  expect(await commentIssue(connection, { issueNumber: 7, body: "검증 완료" }, fetcher)).toMatchObject({ commentId: 3 });
  expect(await updateIssue(connection, { issueNumber: 7, state: "closed" }, fetcher)).toMatchObject({ state: "closed" });
  expect(calls.every(call => call.url.startsWith("https://api.github.com/repos/alice/selected/issues"))).toBe(true);
});

test("foreign repository inputs, invalid numbers and pull requests cannot be mutated", async () => {
  const methods = [];
  const fetcher = async (_url, options) => { methods.push(options.method); return Response.json({ ...data, pull_request: {} }); };
  await expect(createIssue(connection, { title: "t", body: "b", repository: "bob/other" }, fetcher)).rejects.toThrow();
  await expect(getIssue(connection, -1, fetcher)).rejects.toThrow();
  expect(methods).toHaveLength(0);
  await expect(commentIssue(connection, { issueNumber: 7, body: "comment" }, fetcher)).rejects.toThrow("not pull requests");
  await expect(updateIssue(connection, { issueNumber: 7, state: "closed" }, fetcher)).rejects.toThrow("not pull requests");
  expect(methods).toEqual(["GET", "GET"]);
});

test("permission denial requests Issues access and never returns provider error secrets", async () => {
  await expect(createIssue(connection, { title: "t", body: "b" }, async () => Response.json({ secret: "private" }, { status: 403 }))).rejects.toThrow("Issues: Read and write");
});
