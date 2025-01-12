// "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=22093 --disable-infobars --disable-suggestions-ui --no-first-run "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.92 Safari/537.36" --disable-popup-blocking --user-data-dir=C:\Users\hamflx\AppData\Local\Temp\DrissionPage\autoPortData\22093 --no-default-browser-check --disable-features=PrivacySandboxSettings4 --hide-crash-restore-bubble --load-extension=C:\Users\hamflx\sources\cursor-auto-free\turnstilePatch

// const base = "127.0.0.1:22093";
// const base = "127.0.0.1:9220";
const base = "127.0.0.1:22094";

main();

async function main() {
  const send = await cdp(
    `ws://${base}/devtools/page/3E24B3B1E860AA42AD8B75C398E62620`,
    // `ws://${base}/devtools/browser/a0f42c36-a059-4b87-a41b-467e437b5e0c`,
    // "ws://127.0.0.1:9220/devtools/page/352A8024C1D9C724948D1B9BF2BAA7EF",
    // "ws://127.0.0.1:9220/devtools/page/1AF72ABD25C1F4B81451BDAAF9AAF9E5",
    // "ws://127.0.0.1:9220/devtools/page/1CA65E399EAE09A4F5A3F22895E40D6D",
    // "ws://127.0.0.1:9220/devtools/browser/3b96e435-3f5a-40bf-b7b1-2616d0274592",
  );

  console.log("open");
  await send("Target.setDiscoverTargets", { discover: true });
  await send("Page.enable");
  const { frameTree } = await send("Page.getFrameTree");
  const { childFrames } = frameTree;

  const document = await send("DOM.getDocument");
  console.log(document);

  const { nodeId } = await send("DOM.querySelector", {
    selector: "iframe",
    nodeId: document.root.nodeId,
  });

  const { object } = await send("DOM.resolveNode", {
    nodeId,
  });
  console.log("==> object", object);

  const { nodeId: requestNodeId } = send("DOM.requestNode", {
    objectId: object.objectId,
  });
  console.log("==> requestNodeId", requestNodeId);

  const { node } = await send("DOM.describeNode", {
    nodeId,
  });
  console.log("==> node", node);

  let backendNodeId = node.contentDocument.backendNodeId;

  // console.log(frameTree, childFrames);

  await new Promise((resolve) => setTimeout(resolve, 10000));
}

async function cdp(endpoint: string) {
  return new Promise(async (resolve) => {
    const listEndpoint = `http://${new URL(endpoint).host}/json/list`;
    const targets = await fetch(listEndpoint).then((r) => r.json());
    console.log(targets);

    const ws = new WebSocket(endpoint);

    const pendingRequests: Array<{
      seq: number;
      resolve: (value: any) => void;
      reject: (reason?: any) => void;
    }> = [];

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id) {
        const pendingRequest = pendingRequests.find((p) => p.seq === data.id);
        if (pendingRequest) {
          pendingRequest.resolve(data.result);
          pendingRequests.splice(pendingRequests.indexOf(pendingRequest), 1);
        }
      }
      console.log("message", event.data);
    };

    let seq = 1;
    const send = (method: string, params: any = {}) => {
      let resolveRequest: (value: any) => void = () => {};
      let rejectRequest: (reason?: any) => void = () => {};
      const promise = new Promise((resolve, reject) => {
        resolveRequest = resolve;
        rejectRequest = reject;
      });
      ws.send(JSON.stringify({ method, params, id: seq }));
      pendingRequests.push({
        seq,
        resolve: resolveRequest,
        reject: rejectRequest,
      });
      seq++;
      return promise;
    };

    ws.onopen = async () => {
      resolve(send);
    };

    ws.onerror = (event) => {
      console.log("error", event);
    };
  });
}
