export type ExtensionMessage =
  | { type: 'poll-now' }
  | { type: 'test-sound'; sound: string }
  | { type: 'play-sound'; sound: string }
  | { type: 'test-notification' }
  | { type: 'unlock-changed' };

export type ExtensionMessageType = ExtensionMessage['type'];

export type MessageOfType<TType extends ExtensionMessageType> = Extract<
  ExtensionMessage,
  { type: TType }
>;

export type MessageHandler = (message: ExtensionMessage) => void | Promise<void>;
