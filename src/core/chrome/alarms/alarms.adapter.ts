export const MINIMUM_ALARM_PERIOD_MINUTES = 0.5;

export interface RepeatingAlarmOptions {
  periodInMinutes: number;
  delayInMinutes?: number;
}

export const scheduleRepeatingAlarm = async (
  name: string,
  { periodInMinutes, delayInMinutes }: RepeatingAlarmOptions,
): Promise<void> => {
  const period = Math.max(periodInMinutes, MINIMUM_ALARM_PERIOD_MINUTES);
  await chrome.alarms.create(name, {
    periodInMinutes: period,
    delayInMinutes: Math.max(delayInMinutes ?? period, 0),
  });
};

export const getAlarm = async (name: string): Promise<chrome.alarms.Alarm | undefined> =>
  (await chrome.alarms.get(name)) ?? undefined;

export const clearAlarm = (name: string): Promise<boolean> => chrome.alarms.clear(name);

export const onAlarm = (name: string, handler: () => void | Promise<void>): (() => void) => {
  const listener = (alarm: chrome.alarms.Alarm): void => {
    if (alarm.name === name) {
      void Promise.resolve(handler()).catch((error: unknown) => {
        console.error(`Alarm handler "${name}" failed`, error);
      });
    }
  };
  chrome.alarms.onAlarm.addListener(listener);
  return () => {
    chrome.alarms.onAlarm.removeListener(listener);
  };
};
