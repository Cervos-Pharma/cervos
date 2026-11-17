/// <reference types="vite/client" />

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

declare module "date-fns" {
  export function format(date: Date | number | string, formatStr: string, options?: any): string;
  export function formatDistanceToNow(date: Date | number | string, options?: any): string;
  export function parseISO(argument: string): Date;
  export function subDays(date: Date | number, amount: number): Date;
  export function startOfDay(date: Date | number): Date;
}
