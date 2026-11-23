import { Directory, File } from "expo-file-system";
import { requireNativeModule } from "expo";
import { Platform } from "react-native";
import { CHANNEL_LIST_MAX_BYTES, ChannelListError } from "@/domain/channelList";

export type TransferFolder = { folder: string; files: string[] };
type TVFiles = {
  readPickedDocument(uri: string): Promise<string>;
  list(): Promise<TransferFolder>;
  read(name: string): Promise<string>;
  write(name: string, text: string): Promise<string>;
};

const androidFiles = () => requireNativeModule<TVFiles>("FrameTransfer");
export const listTransferFiles = () => androidFiles().list();
export const readTransferFile = (name: string) => androidFiles().read(name);

function cancelled(error: unknown) {
  return error instanceof Error && /cancel/i.test(error.message);
}

export async function saveChannelFile(name: string, text: string): Promise<string | null> {
  if (Platform.isTV) return androidFiles().write(name, text);
  try {
    const directory = await Directory.pickDirectoryAsync();
    const file = directory.createFile(name, "text/markdown");
    try { file.write(text); } catch (error) { file.delete(); throw error; }
    return name;
  } catch (error) { if (cancelled(error)) return null; throw error; }
}

export async function pickChannelFile(): Promise<string | null> {
  try {
    const selection = await File.pickFileAsync();
    const file = Array.isArray(selection) ? selection[0] : selection;
    if (!file) return null;
    if (file.size > CHANNEL_LIST_MAX_BYTES) throw new ChannelListError("Choose a Markdown file under 1 MB.");
    if (Platform.OS === "android" && file.uri.startsWith("content:")) return androidFiles().readPickedDocument(file.uri);
    return file.text();
  } catch (error) { if (cancelled(error)) return null; throw error; }
}
