import { providerKeyStore } from "../storage/providerKeyStore";
import { createProviderTransport } from "./providerRequest";
import { createByokYouTube } from "./byokYouTube";

export const providerTransport = createProviderTransport(providerKeyStore);
export const byokYouTube = createByokYouTube(providerTransport, providerKeyStore);
