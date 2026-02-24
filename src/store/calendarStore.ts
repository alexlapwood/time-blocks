import { createStore } from "solid-js/store";
import { createEffect, onCleanup } from "solid-js";

export type ExternalEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  duration: number; // in minutes
};

export type CalendarStoreState = {
  accessToken: string | null;
  tokenExpiresAt: number;
  events: ExternalEvent[];
  lastFetched: number;
  error: string | null;
  isLoading: boolean;
};

const STORAGE_KEY = "timeblocks-calendar-settings";
const GOOGLE_CLIENT_ID =
  "883509962602-4bh6o8kcaib87c6p1jv0dgl8cm2rbe6l.apps.googleusercontent.com";

function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export function createCalendarStore() {
  const stored = localStorage.getItem(STORAGE_KEY);
  let initialState: CalendarStoreState = {
    accessToken: null,
    tokenExpiresAt: 0,
    events: [],
    lastFetched: 0,
    error: null,
    isLoading: false,
  };

  try {
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object") {
        const token = parsed.accessToken || null;
        const expiresAt = parsed.tokenExpiresAt || 0;
        if (token && Date.now() < expiresAt) {
          initialState.accessToken = token;
          initialState.tokenExpiresAt = expiresAt;
        }
      }
    }
  } catch (e) {
    console.error("Failed to load calendar settings", e);
  }

  const [state, setState] = createStore<CalendarStoreState>(initialState);

  // Save config to local storage whenever it changes
  createEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accessToken: state.accessToken,
        tokenExpiresAt: state.tokenExpiresAt,
      }),
    );
  });

  const connect = async () => {
    setState({ isLoading: true, error: null });

    try {
      await loadGisScript();

      await new Promise<void>((resolve, reject) => {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: "https://www.googleapis.com/auth/calendar.readonly",
          callback: (tokenResponse: any) => {
            if (tokenResponse.error !== undefined) {
              reject(tokenResponse);
            }
            setState({
              accessToken: tokenResponse.access_token,
              tokenExpiresAt: Date.now() + tokenResponse.expires_in * 1000,
            });
            resolve();
          },
        });
        client.requestAccessToken({ prompt: "" });
      });

      await fetchEvents();
    } catch (e: any) {
      console.error("Error connecting to Google Calendar:", e);
      setState({
        error: e.message || "Failed to connect to Google Calendar",
        isLoading: false,
      });
    }
  };

  const disconnect = () => {
    setState({
      accessToken: null,
      tokenExpiresAt: 0,
      events: [],
      error: null,
    });
  };

  const fetchEvents = async () => {
    if (!state.accessToken) return;

    if (Date.now() > state.tokenExpiresAt) {
      setState({
        accessToken: null,
        tokenExpiresAt: 0,
        error: "Calendar session expired. Please reconnect.",
      });
      return;
    }

    setState({ isLoading: true, error: null });

    try {
      // Fetch from today to 7 days ahead
      const timeMin = new Date();
      timeMin.setHours(0, 0, 0, 0);
      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + 7);

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&singleEvents=true&orderBy=startTime`,
        {
          headers: {
            Authorization: `Bearer ${state.accessToken}`,
          },
        },
      );

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setState({
            accessToken: null,
            tokenExpiresAt: 0,
            error: "Session expired. Please reconnect.",
          });
        }
        throw new Error(`Failed to fetch calendar: ${response.statusText}`);
      }

      const data = await response.json();

      const parsedEvents: ExternalEvent[] = (data.items || []).map(
        (item: any) => {
          const start = new Date(item.start.dateTime || item.start.date);
          const end = new Date(item.end.dateTime || item.end.date);
          const duration = (end.getTime() - start.getTime()) / (1000 * 60);

          return {
            id: item.id,
            title: item.summary || "Busy",
            start,
            end,
            duration,
          };
        },
      );

      setState({
        events: parsedEvents,
        lastFetched: Date.now(),
        isLoading: false,
      });
    } catch (e: any) {
      console.error("Error fetching Google Calendar events:", e);
      setState({
        error: e.message || "Failed to fetch calendar",
        isLoading: false,
      });
    }
  };

  // Poll every 10 minutes if connected
  createEffect(() => {
    if (state.accessToken && Date.now() < state.tokenExpiresAt) {
      fetchEvents();
      const interval = setInterval(fetchEvents, 10 * 60 * 1000);
      onCleanup(() => clearInterval(interval));
    }
  });

  return [state, { connect, disconnect, fetchEvents }] as const;
}

let calendarStoreInstance: ReturnType<typeof createCalendarStore> | undefined;

export function useCalendarStore() {
  if (!calendarStoreInstance) {
    calendarStoreInstance = createCalendarStore();
  }
  return calendarStoreInstance;
}
