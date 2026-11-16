"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Tournament = { id:string; name:string; team_a:string; team_b:string; score_a:number; score_b:number };
type Winner = { id:string; sport:string; winner_name:string };
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
export default function Home() {
  const db = supabase();
  const [tournament,setTournament] = useState<Tournament|null>(null);
  const [winners,setWinners] = useState<Winner[]>([]);
  const [user,setUser] = useState<string|null>(null);
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [page,setPage] = useState<"scores"|"winners">("scores");
  const [editing,setEditing] = useState(false);
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);

  async function load() {
    const [{data:t,error:te},{data:w,error:we},{data:{user:u}}] = await Promise.all([
      db.from("tournaments").select("*").limit(1).single(),
      db.from("winners").select("*").order("sport"),
      db.auth.getUser()
    ]);
    if(te) setMessage(te.message); else setTournament(t);
    if(we) setMessage(we.message); else setWinners(w||[]);
    setUser(u?.email||null);
  }
  useEffect(()=>{
    load();
    const channel=db.channel("arena-live").on("postgres_changes",{event:"*",schema:"public",table:"tournaments"},()=>load())
      .on("postgres_changes",{event:"*",schema:"public",table:"winners"},()=>load()).subscribe();
    const {data:{subscription}}=db.auth.onAuthStateChange(()=>load());
    return ()=>{db.removeChannel(channel);subscription.unsubscribe()};
  },[]);

  async function updateTournament(patch:Partial<Tournament>) {
    if(!tournament || !user) return;
    setBusy(true);setMessage("");
    const {error}=await db.from("tournaments").update(patch).eq("id",tournament.id);
    if(error)setMessage(error.message);else setMessage("Saved and synced for all viewers.");
    setBusy(false);load();
  }
  async function updateWinner(id:string,winner_name:string) {
    if(!user)return;
    const {error}=await db.from("winners").update({winner_name}).eq("id",id);
    setMessage(error?error.message:"Winner updated and synced.");load();
  }
  async function signIn(e:React.FormEvent) {
    e.preventDefault();setBusy(true);setMessage("");
    const {error}=await db.auth.signInWithPassword({email,password});
    setMessage(error?error.message:"Owner signed in.");setBusy(false);setPassword("");load();
  }
  async function signOut(){await db.auth.signOut();setEditing(false);setMessage("Signed out.");load()}
  const isOwner=!!user;

  return <main className="shell">
    <header className="hero">
      <div className="row"><div className="brand">🏆 ARENA</div><span className="badge">{isOwner?"OWNER MODE":"VIEWER MODE"}</span></div>
      <h1>{tournament?.name||"Sports Championship"}</h1>
      <div className="sub">THE OFFICIAL TOURNAMENT HUB</div>
    </header>
    <nav className="nav">
      <button className={page==="scores"?"active":""} onClick={()=>setPage("scores")}>📊 Live Scores</button>
      <button className={page==="winners"?"active":""} onClick={()=>setPage("winners")}>🏆 Winners</button>
    </nav>

    {page==="scores" && <section>
      <h2>Live Scoreboard</h2>
      {!tournament ? <div className="panel">Loading tournament…</div> : <>
        {isOwner&&editing&&<div className="panel stack" style={{marginBottom:14}}>
          <label>Tournament name<input defaultValue={tournament.name} id="eventName"/></label>
          <div className="row"><label>Team 1<input defaultValue={tournament.team_a} id="teamA"/></label><label>Team 2<input defaultValue={tournament.team_b} id="teamB"/></label></div>
          <button className="btn primary" onClick={()=>updateTournament({name:(document.getElementById("eventName") as HTMLInputElement).value,team_a:(document.getElementById("teamA") as HTMLInputElement).value,team_b:(document.getElementById("teamB") as HTMLInputElement).value})}>Save match details</button>
        </div>}
        <div className="grid">
          {[{name:tournament.team_a,score:tournament.score_a,key:"score_a" as const},{name:tournament.team_b,score:tournament.score_b,key:"score_b" as const}].map((team,i)=><div className="panel team" key={i}>
            <h3>{team.name}</h3><div className="score">{team.score}</div>
            {isOwner&&<div className="controls"><button disabled={busy} onClick={()=>updateTournament({[team.key]:Math.max(0,team.score-1)})}>−</button><button className="btn primary" disabled={busy} onClick={()=>updateTournament({[team.key]:team.score+1})}>+</button></div>}
          </div>)}
        </div>
        <div className="panel status"><div className="muted">MATCH STATUS</div><strong>{tournament.score_a===tournament.score_b?"MATCH DRAWN":tournament.score_a>tournament.score_b?`${tournament.team_a} LEADING`:`${tournament.team_b} LEADING`}</strong></div>
        {isOwner&&<button className="btn danger" style={{width:"100%",marginTop:12}} onClick={()=>updateTournament({score_a:0,score_b:0})}>↻ Reset scores</button>}
      </>}
    </section>}

    {page==="winners"&&<section className="stack">
      <div><h2>🏆 Winners Hall</h2><p className="muted">The champions of every sport.</p></div>
      {SPORTS.map(sport=>{
        const w=winners.find(x=>x.sport===sport);
        return <div className="panel winner" key={sport}><span className="emoji">🏅</span><div style={{flex:1}}><strong>{sport}</strong>
          {isOwner?<input aria-label={`${sport} winner`} value={w?.winner_name||""} placeholder="Enter winner's name" onChange={e=>w&&setWinners(old=>old.map(x=>x.id===w.id?{...x,winner_name:e.target.value}:x))} onBlur={e=>w&&updateWinner(w.id,e.target.value)}/>:<div className="muted">{w?.winner_name||"Not announced"}</div>}
        </div><span className="badge">{w?.winner_name?"WINNER":"PENDING"}</span></div>
      })}
    </section>}

    <section className="panel admin stack">
      <div className="row"><strong>⚙️ Administration</strong><span className="badge">{isOwner?"EDITING ENABLED":"READ ONLY"}</span></div>
      {!isOwner?<form onSubmit={signIn} className="stack">
        <p className="muted">Owner login. Viewers do not need an account.</p>
        <label>Owner email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="owner@example.com"/></label>
        <label>Password<input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your owner password"/></label>
        <button className="btn primary" disabled={busy}>{busy?"Signing in…":"🔐 Owner Login"}</button>
      </form>:<div className="stack">
        <button className="btn secondary" onClick={()=>setEditing(!editing)}>{editing?"Close match editor":"Edit match details"}</button>
        <button className="btn secondary" onClick={signOut}>Log out</button>
      </div>}
    </section>
    <div className="toast" role="status">{message}</div>
    <footer className="muted" style={{textAlign:"center",marginTop:20}}>ARENA • Live tournament management</footer>
  </main>;
}
