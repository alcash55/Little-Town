import { HttpFunction } from "@google-cloud/functions-framework";
import * as url from "url";
import { hiscores } from "./hiscores.js";

/**
 * @see https://supabase.com/docs/reference/javascript/introduction
 */
export const LittleTownFunctions: HttpFunction = async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  const requestUrl = req.url;

  const parsedUrl = url.parse(requestUrl, true);
  const pathname = parsedUrl.pathname;
  const queryParams = parsedUrl.query;

  if (req.method === "OPTIONS") {
    // Send response to OPTIONS requests
    res.set("Access-Control-Allow-Methods", "POST,PUT");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.set("Access-Control-Max-Age", "3600");
    res.status(204).send("");
  } else if (req.method === "PUT") {
    if (pathname === "/hiscores") {
      try {
        const data = await hiscores(queryParams.player);
        res.send(data);
      } catch (e) {
        console.log(e);
        res.status(500).send({ error: "Internal Server Error" });
      }
    }
  } else if (req.method === "POST") {
    if (pathname === "/admin") {
      try {
      } catch (e) {
        console.log(e);
        res.status(500).send({ error: "Internal Server Error" });
      }
    }
  } else res.send("hello");
};
