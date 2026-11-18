
"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

type Tournament = {
  id: string;
  name: string;
  team_a: string;
  team_b: string;
  score_a: number;
  score_b: number;
};

type Winner = { id: string; sport: string; winner_name: string };

type News = {
  id: string;
  title: string;
  body: string;
  image_url: string;
  created_at: string;
};

type ArenaEvent = {
  id: string;
  title: string;
  sport: string;
  event_date: string;
  start_time: string;
  venue: string;
};

const SPORTS = [
  "Carrom 7-18 Years Old",
  "Carrom Men",
  "Carrom Women",
  "Football 7-11 Years Old",
  "Football 12-18 Years Old",
  "Football Men",
  "Cricket 7-11 Years Old",
  "Cricket 12-18 Years Old",
  "Cricket Men",
  "Cricket Women",
  "Chess 7-18 Years Old",
  "Chess Men",
  "Chess Women",
  "Table Tennis 7-18 Years Old",
  "Table Tennis Men",
  "Badminton 7-11 Years Old",
  "Badminton 12-18 Years Old",
  "Badminton Men",
  "Badminton Women",
  "Kho-kho 7-11 Years Old",
  "Kho-kho 12-18 Years Old",
  "Kho-kho Women",
  "Walkathon",
  "Duothon",
  "Cyclothon"
];

function getIndiaDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export default function Home() {
  const db = supabase();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [winnerDrafts, setWinnerDrafts] = useState<Record<string, string>>({});
  const [news, setNews] = useState<News[]>([]);
  const [events, setEvents] = useState<ArenaEvent[]>([]);
  const [user, setUser] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [page, setPage] = useState<"news" | "scores" | "winners" | "events">("news");

  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [newsTitle, setNewsTitle] = useState("");
  const [newsBody, setNewsBody] = useState("");
  const [newsImage, setNewsImage] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [eventTitle, setEventTitle] = useState("");
  const [eventSport, setEventSport] = useState(SPORTS[0]);
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("09:00");
  const [eventVenue, setEventVenue] = useState("");

  const isOwner = !!user;
  const today = getIndiaDate();
  const todaysEvents = events.filter(event => event.event_date === today);

  async function load() {
    const [
      { data: t, error: te },
      { data: w, error: we },
      { data: n, error: ne },
      { data: ev, error: ee },
      { data: { user: u } }
    ] = await Promise.all([
      db.from("tournaments").select("*").limit(1).single(),
      db.from("winners").select("*").order("sport"),
      db.from("arena_news").select("*").order("created_at", { ascending: false }),
      db.from("arena_events").select("*").order("event_date").order("start_time"),
      db.auth.getUser()
    ]);

    if (te) setMessage(te.message);
    else setTournament(t);

    if (we) setMessage(we.message);
    else {
      setWinners(w || []);
      setWinnerDrafts(
        Object.fromEntries((w || []).map(item => [item.sport, item.winner_name]))
      );
    }

    if (ne) setMessage(ne.message);
    else setNews(n || []);

    if (ee) setMessage(ee.message);
    else setEvents(ev || []);

    setUser(u?.email || null);
  }

  useEffect(() => {
    setEventDate(getIndiaDate());
    load();

    const channel = db
      .channel("arena-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "winners" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "arena_news" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "arena_events" }, () => load())
      .subscribe();

    const { data: { subscription } } = db.auth.onAuthStateChange(() => load());

    return () => {
      db.removeChannel(channel);
      subscription.unsubscribe();
    };
  }, []);

  async function updateTournament(patch: Partial<Tournament>) {
    if (!tournament || !user) return;

    setBusy(true);
    setMessage("");

    const { error } = await db
      .from("tournaments")
      .update(patch)
      .eq("id", tournament.id);

    setMessage(error ? error.message : "Saved and synced for all viewers.");
    setBusy(false);
    load();
  }

  async function saveWinner(sport: string, id: string | undefined, winner_name: string) {
    if (!user) return;

    const result = id
      ? await db.from("winners").update({ winner_name }).eq("id", id)
      : await db.from("winners").insert({ sport, winner_name });

    setMessage(result.error ? result.error.message : "Winner saved and synced.");
    load();
  }

  async function publishNews(e: FormEvent) {
    e.preventDefault();

    if (!newsTitle.trim() || !newsBody.trim() || !newsImage) {
      setMessage("Please add a title, description and image.");
      return;
    }

    if (!newsImage.type.startsWith("image/")) {
      setMessage("Please select an image file.");
      return;
    }

    if (newsImage.size > 5 * 1024 * 1024) {
      setMessage("Image must be smaller than 5 MB.");
      return;
    }

    setBusy(true);
    setMessage("");

    const extension = newsImage.name.split(".").pop() || "jpg";
    const path = `${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await db.storage
      .from("arena-news")
      .upload(path, newsImage);

    if (uploadError) {
      setMessage(uploadError.message);
      setBusy(false);
      return;
    }

    const { data: publicData } = db.storage
      .from("arena-news")
      .getPublicUrl(path);

    const { error: insertError } = await db.from("arena_news").insert({
      title: newsTitle.trim(),
      body: newsBody.trim(),
      image_url: publicData.publicUrl
    });

    if (insertError) {
      await db.storage.from("arena-news").remove([path]);
      setMessage(insertError.message);
    } else {
      setMessage("News published!");
      setNewsTitle("");
      setNewsBody("");
      setNewsImage(null);
      if (fileInput.current) fileInput.current.value = "";
      load();
    }

    setBusy(false);
  }

  async function deleteNews(item: News) {
    if (!user || !confirm("Delete this news post?")) return;

    const marker = "/arena-news/";
    const index = item.image_url.indexOf(marker);

    if (index >= 0) {
      const path = decodeURIComponent(item.image_url.substring(index + marker.length));
      await db.storage.from("arena-news").remove([path]);
    }

    const { error } = await db.from("arena_news").delete().eq("id", item.id);
    setMessage(error ? error.message : "News deleted.");
    load();
  }

  async function addEvent(e: FormEvent) {
    e.preventDefault();

    if (!eventTitle.trim() || !eventDate || !eventTime || !eventVenue.trim()) {
      setMessage("Please fill in all event details.");
      return;
    }

    setBusy(true);

    const { error } = await db.from("arena_events").insert({
      title: eventTitle.trim(),
      sport: eventSport,
      event_date: eventDate,
      start_time: eventTime,
      venue: eventVenue.trim()
    });

    setMessage(error ? error.message : "Event added successfully.");
    if (!error) {
      setEventTitle("");
      setEventVenue("");
      setEventDate(getIndiaDate());
      setEventTime("09:00");
      load();
    }

    setBusy(false);
  }

  async function deleteEvent(id: string) {
    if (!user || !confirm("Delete this event?")) return;

    const { error } = await db.from("arena_events").delete().eq("id", id);
    setMessage(error ? error.message : "Event deleted.");
    load();
  }

  async function signIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");

    const { error } = await db.auth.signInWithPassword({ email, password });

    setMessage(error ? error.message : "Owner signed in.");
    setBusy(false);
    setPassword("");
    load();
  }

  async function signOut() {
    await db.auth.signOut();
    setEditing(false);
    setMessage("Signed out.");
    load();
  }

  return (
    <main className="shell">
      <header className="hero">
        <div className="row">
          <div className="brand">🏆 ARENA</div>
          <span className="badge">{isOwner ? "OWNER MODE" : "VIEWER MODE"}</span>
        </div>
        <h1>{tournament?.name || "Sports Championship"}</h1>
        <div className="sub">THE OFFICIAL TOURNAMENT HUB</div>
      </header>

      <nav className="nav">
        <button className={page === "news" ? "active" : ""} onClick={() => setPage("news")}>📰 News</button>
        <button className={page === "scores" ? "active" : ""} onClick={() => setPage("scores")}>📊 Live Scores</button>
        <button className={page === "winners" ? "active" : ""} onClick={() => setPage("winners")}>🏆 Winners</button>
        <button className={page === "events" ? "active" : ""} onClick={() => setPage("events")}>📅 Scheduled Events</button>
      </nav>

      {page === "news" && (
        <section className="stack">
          <div>
            <h2>📰 Latest News</h2>
            <p className="muted">The latest updates from ARENA.</p>
          </div>

          {isOwner && (
            <form className="panel stack" onSubmit={publishNews}>
              <h3>Publish News</h3>
              <label>
                Headline
                <input value={newsTitle} onChange={e => setNewsTitle(e.target.value)} placeholder="Enter news headline" required />
              </label>
              <label>
                Short description
                <textarea value={newsBody} onChange={e => setNewsBody(e.target.value)} maxLength={300} rows={3} placeholder="Write your 2-line update..." required />
              </label>
              <label>
                Upload image
                <input ref={fileInput} type="file" accept="image/*" onChange={e => setNewsImage(e.target.files?.[0] || null)} required />
              </label>
              <p className="muted">Maximum image size: 5 MB.</p>
              <button className="btn primary" disabled={busy}>
                {busy ? "Publishing..." : "📤 Publish News"}
              </button>
            </form>
          )}

          {news.length === 0 ? (
            <div className="panel empty-news">No news published yet.</div>
          ) : (
            <div className="news-grid">
              {news.map(item => (
                <article className="panel news-card" key={item.id}>
                  <img className="news-image" src={item.image_url} alt={item.title} />
                  <div className="news-content">
                    <div className="news-date">
                      {new Date(item.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric"
                      })}
                    </div>
                    <h3>{item.title}</h3>
                    <p className="news-body">{item.body}</p>
                    {isOwner && (
                      <button className="btn danger" onClick={() => deleteNews(item)}>
                        Delete News
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {page === "scores" && (
        <section>
          <h2>📊 Live Scoreboard</h2>

          {!tournament ? (
            <div className="panel">Loading tournament...</div>
          ) : (
            <>
              {isOwner && editing && (
                <div className="panel stack" style={{ marginBottom: 14 }}>
                  <label>
                    Tournament name
                    <input defaultValue={tournament.name} id="eventName" />
                  </label>
                  <div className="row">
                    <label>
                      Team 1
                      <input defaultValue={tournament.team_a} id="teamA" />
                    </label>
                    <label>
                      Team 2
                      <input defaultValue={tournament.team_b} id="teamB" />
                    </label>
                  </div>
                  <button
                    className="btn primary"
                    onClick={() => updateTournament({
                      name: (document.getElementById("eventName") as HTMLInputElement).value,
                      team_a: (document.getElementById("teamA") as HTMLInputElement).value,
                      team_b: (document.getElementById("teamB") as HTMLInputElement).value
                    })}
                  >
                    Save match details
                  </button>
                </div>
              )}

              <div className="grid">
                {[
                  { name: tournament.team_a, score: tournament.score_a, key: "score_a" as const },
                  { name: tournament.team_b, score: tournament.score_b, key: "score_b" as const }
                ].map((team, i) => (
                  <div className="panel team" key={i}>
                    <h3>{team.name}</h3>
                    <div className="score">{team.score}</div>
                    {isOwner && (
                      <div className="controls">
                        <button disabled={busy} onClick={() => updateTournament({ [team.key]: Math.max(0, team.score - 1) })}>−</button>
                        <button className="btn primary" disabled={busy} onClick={() => updateTournament({ [team.key]: team.score + 1 })}>+</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="panel status">
                <div className="muted">MATCH STATUS</div>
                <strong>
                  {tournament.score_a === tournament.score_b
                    ? "MATCH DRAWN"
                    : tournament.score_a > tournament.score_b
                    ? `${tournament.team_a} LEADING`
                    : `${tournament.team_b} LEADING`}
                </strong>
              </div>

              {isOwner && (
                <button className="btn danger" style={{ width: "100%", marginTop: 12 }} onClick={() => updateTournament({ score_a: 0, score_b: 0 })}>
                  ↻ Reset scores
                </button>
              )}
            </>
          )}
        </section>
      )}

      {page === "winners" && (
        <section className="stack">
          <div>
            <h2>🏆 Winners Hall</h2>
            <p className="muted">The champions of every sport.</p>
          </div>

          {SPORTS.map(sport => {
            const winner = winners.find(item => item.sport === sport);

            return (
              <div className="panel winner" key={sport}>
                <span className="emoji">🏅</span>
                <div style={{ flex: 1 }}>
                  <strong>{sport}</strong>
                  {isOwner ? (
                    <input
                      aria-label={`${sport} winner`}
                      value={winnerDrafts[sport] ?? ""}
                      placeholder="Enter winner's name"
                      onChange={e => setWinnerDrafts(old => ({ ...old, [sport]: e.target.value }))}
                      onBlur={e => saveWinner(sport, winner?.id, e.target.value)}
                    />
                  ) : (
                    <div className="muted">{winner?.winner_name || "Not announced"}</div>
                  )}
                </div>
                <span className="badge">{winner?.winner_name ? "WINNER" : "PENDING"}</span>
              </div>
            );
          })}
        </section>
      )}

      {page === "events" && (
        <section className="stack">
          <div>
            <h2>📅 Today's Scheduled Events</h2>
            <p className="muted">
              {new Date(`${today}T12:00:00+05:30`).toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
              })}
              {" · India time"}
            </p>
          </div>

          {isOwner && (
            <form className="panel stack" onSubmit={addEvent}>
              <h3>Add Scheduled Event</h3>
              <label>
                Event name
                <input value={eventTitle} onChange={e => setEventTitle(e.target.value)} placeholder="Enter event name" required />
              </label>
              <label>
                Sport
                <select value={eventSport} onChange={e => setEventSport(e.target.value)}>
                  {SPORTS.map(sport => <option key={sport} value={sport}>{sport}</option>)}
                </select>
              </label>
              <div className="form-grid">
                <label>
                  Date
                  <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required />
                </label>
                <label>
                  Start time
                  <input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} required />
                </label>
              </div>
              <label>
                Venue
                <input value={eventVenue} onChange={e => setEventVenue(e.target.value)} placeholder="Enter venue" required />
              </label>
              <button className="btn primary" disabled={busy}>
                {busy ? "Adding..." : "＋ Add Event"}
              </button>
            </form>
          )}

          {todaysEvents.length === 0 ? (
            <div className="panel empty-news">
              No events scheduled for today.
            </div>
          ) : (
            <div className="event-list">
              {todaysEvents.map(event => (
                <div className="panel event-card" key={event.id}>
                  <div className="event-time">{formatTime(event.start_time)}</div>
                  <div className="event-details">
                    <h3>{event.title}</h3>
                    <p className="muted">{event.sport}</p>
                    <p>📍 {event.venue}</p>
                  </div>
                  {isOwner && (
                    <button className="btn danger" onClick={() => deleteEvent(event.id)}>
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="panel admin stack">
        <div className="row">
          <strong>⚙️ Administration</strong>
          <span className="badge">{isOwner ? "EDITING ENABLED" : "READ ONLY"}</span>
        </div>

        {!isOwner ? (
          <form onSubmit={signIn} className="stack">
            <p className="muted">Owner login. Viewers do not need an account.</p>
            <label>
              Owner email
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="owner@example.com" />
            </label>
            <label>
              Password
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Your owner password" />
            </label>
            <button className="btn primary" disabled={busy}>
              {busy ? "Signing in..." : "🔐 Owner Login"}
            </button>
          </form>
        ) : (
          <div className="stack">
            <button className="btn secondary" onClick={() => setEditing(!editing)}>
              {editing ? "Close match editor" : "Edit match details"}
            </button>
            <button className="btn secondary" onClick={signOut}>Log out</button>
          </div>
        )}
      </section>

      <div className="toast" role="status">{message}</div>
      <footer className="muted" style={{ textAlign: "center", marginTop: 20 }}>
        ARENA • Live tournament management
      </footer>
    </main>
  );
}
