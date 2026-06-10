import chatHandler from "./chat.js";

const req = {
  method: "POST",
  url: "/api/chat",
  body: { messages: [{ role: "user", content: "hello" }] },
  headers: { "content-type": "application/json" }
} as any;

const res = {
  headersSent: false,
  setHeader: console.log,
  status: (code: number) => {
    console.log("Status:", code);
    return res;
  },
  json: (data: any) => {
    console.log("JSON:", data);
  },
  end: () => console.log("End")
} as any;

console.log("Running handler...");
try {
  chatHandler(req, res);
} catch (e) {
  console.error("Crash:", e);
}
