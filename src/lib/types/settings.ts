export type AppSettings = {
  defaultModelId: string;
  language: string;
  translate: boolean;
  autoCopy: boolean;
  startAtLogin: boolean;
  audioInputDeviceId?: string | null;
};
