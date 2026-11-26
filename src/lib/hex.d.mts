export type Device = {
  name: string;
  words: number;
  eeprom: number;
  pins: number;
  ram: number;
  id: string;
  reserved: number;
};
export type Board = {
  id: string;
  name: string;
  description: string;
  fqbn: string;
  baud: number;
};
export const DEVICES: Device[];
export const BOARDS: Board[];
export const SAMPLE_HEX: string;
export const MAX_HEX_SIZE: number;
export type ParsedHex = {
  bytes: Map<number, number>;
  records: number;
  size: number;
};
export function parseHex(text: string): ParsedHex;
export function validateHex(text: string, target: string): ParsedHex;
export function encodeHex(bytes: Map<number, number>): string;
