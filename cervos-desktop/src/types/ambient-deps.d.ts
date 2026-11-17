/// <reference types="vite/client" />

declare module "*?url" {
  const src: string;
  export default src;
}

declare module "react-router-dom" {
  import type * as React from "react";
  export function BrowserRouter(props: { children?: React.ReactNode }): React.ReactElement | null;
  export function Routes(props: { children?: React.ReactNode }): React.ReactElement | null;
  export function Route(props: {
    path?: string;
    index?: boolean;
    element?: React.ReactNode;
    children?: React.ReactNode;
  }): React.ReactElement | null;
  export function Navigate(props: { to: string; replace?: boolean; state?: unknown }): React.ReactElement | null;
  export function Outlet(props: { context?: unknown }): React.ReactElement | null;
  export function Link(props: {
    to: string;
    className?: string;
    children?: React.ReactNode;
    [key: string]: any;
  }): React.ReactElement | null;
  export function NavLink(props: {
    to: string;
    end?: boolean;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
    className?: string | ((props: { isActive: boolean; isPending: boolean }) => string);
    children?: React.ReactNode;
    [key: string]: any;
  }): React.ReactElement | null;
  export function useNavigate(): (to: string | number, options?: { replace?: boolean; state?: unknown }) => void;
  export function useLocation(): { pathname: string; search: string; hash: string; state: unknown; key: string };
  export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T;
}

declare module "zustand" {
  export type SetState<T> = (
    partial: T | Partial<T> | ((state: T) => T | Partial<T>),
    replace?: boolean
  ) => void;
  export type GetState<T> = () => T;
  export type StateCreator<T, Mis = [], Mos = [], U = T> = (
    set: SetState<T>,
    get: GetState<T>,
    api: any
  ) => U;
  export interface UseBoundStore<T> {
    (): T;
    <U>(selector: (state: T) => U): U;
    getState: () => T;
    setState: SetState<T>;
    subscribe: (listener: (state: T, prevState: T) => void) => () => void;
  }
  export function create<T>(initializer: StateCreator<T, any, any>): UseBoundStore<T>;
  export function create<T>(): (initializer: StateCreator<T, any, any>) => UseBoundStore<T>;
}

declare module "zustand/middleware" {
  import type { StateCreator } from "zustand";
  export function persist<T>(
    config: StateCreator<T, any, any>,
    options?: {
      name: string;
      partialize?: (state: T) => Partial<T>;
      onRehydrateStorage?: (state: T) => ((state?: T, error?: unknown) => void) | void;
      [key: string]: any;
    }
  ): StateCreator<T, any, any>;
}

declare module "sql.js" {
  export default function initSqlJs(config?: { locateFile?: (file: string) => string }): Promise<any>;
}

declare module "jspdf" {
  export class jsPDF {
    constructor(options?: any);
    [key: string]: any;
  }
  export default jsPDF;
}

declare module "@tauri-apps/plugin-fs" {
  export const BaseDirectory: {
    AppLocalData: number;
    AppData: number;
    [key: string]: number;
  };
  export function exists(path: string, options?: { baseDir?: number }): Promise<boolean>;
  export function readFile(path: string, options?: { baseDir?: number }): Promise<Uint8Array>;
  export function writeFile(path: string, data: Uint8Array, options?: { baseDir?: number }): Promise<void>;
}

declare module "@tauri-apps/plugin-shell" {
  export function open(path: string, openWith?: string): Promise<void>;
}

declare module "@tauri-apps/plugin-notification" {
  export function isPermissionGranted(): Promise<boolean>;
  export function requestPermission(): Promise<"granted" | "denied" | "default">;
  export function sendNotification(options: string | { title: string; body?: string;[key: string]: any }): void;
  export function onAction(cb: (notification: any) => void): Promise<() => void>;
}
