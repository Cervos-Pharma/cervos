/**
 * Event dispatched by <MobileMenuButton /> (in each page's header) and heard
 * by every portal sidebar to open its mobile slide-in drawer. Using a window
 * event keeps server-component pages free of client state: they just render
 * the button, and the sidebar (a client component) owns the open/close state.
 */
export const SIDEBAR_OPEN_EVENT = "cervos:open-sidebar";
