import { CHANNEL_LIST_MAX_BYTES, ChannelListError } from "@/domain/channelList";
import type { TransferFolder } from "./channelListFiles";

export async function saveChannelFile(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.download = name;
  a.href = url;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}

export function pickChannelFile(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".md,.markdown,text/markdown";
    input.oncancel = () => resolve(null);
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      if (file.size > CHANNEL_LIST_MAX_BYTES) return reject(new ChannelListError("Choose a Markdown file under 1 MB."));
      file.text().then(resolve, reject);
    };
    input.click();
  });
}

export async function listTransferFiles(): Promise<TransferFolder> { throw new Error("TV only"); }
export async function readTransferFile(_name: string): Promise<string> { throw new Error("TV only"); }
