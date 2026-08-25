/** Browser stub so NanoVM's Node-only dynamic imports resolve in Turbopack. */

export async function readFile(): Promise<Uint8Array> {
  throw new Error("Node fs is not available in the browser.");
}

export async function writeFile(): Promise<void> {
  throw new Error("Node fs is not available in the browser.");
}

export default {};
