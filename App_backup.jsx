import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import {
  DndContext,
  closestCenter
} from "@dnd-kit/core";

import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";

export default function App() {
  const [code, setCode] = useState(["", "", "", ""]);
  const [error, setError] = useState(false);
  const [user, setUser] = useState(null);
  const [race, setRace] = useState(null);
  const [view, setView] = useState("races");
  const [adminMode, setAdminMode] = useState(false);

  function logout() {
    setUser(null);
    setRace(null);
    setView("races");
    setAdminMode(false);
    setCode(["", "", "", ""]);
  }

  async function login(customCode = null) {
    const enteredCode = customCode || code.join("");

    const { data } = await supabase
      .from("players")
      .select("*")
      .eq("login_code", enteredCode);

    if (data && data.length > 0) {
      setUser(data[0]);
    } else {
      setError(true);
      setCode(["", "", "", ""]);
      setTimeout(() => setError(false), 500);
    }
  }

  // LOGIN
  if (!user) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className={`w-[360px] p-10 rounded-2xl bg-zinc-900 border border-zinc-800 ${error ? "animate-shake" : ""}`}>
          
          <h1 className="text-3xl font-black text-red-500 mb-2">
            🏎️ F1 Tipovačka
          </h1>

          <div className="flex justify-between mb-4">
            {code.map((digit, i) => (
              <input
                key={i}
                id={`pin-${i}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                autoFocus={i === 0}
                value={digit}
                className="w-14 h-14 text-center text-2xl rounded-xl bg-black border border-zinc-700 text-white outline-none caret-transparent"
                onChange={(e) => {
                  const val = e.target.value.slice(-1);
                  const newCode = [...code];
                  newCode[i] = val;
                  setCode(newCode);

                  if (val && i < 3) {
                    document.getElementById(`pin-${i + 1}`)?.focus();
                  }

                  if (newCode.every((x) => x !== "")) {
                    setTimeout(() => login(newCode.join("")), 50);
                  }
                }}
              />
            ))}
          </div>

          {error && (
            <div className="text-red-500 text-center mb-3">
              ❌ Neplatný kód
            </div>
          )}

          <button
            className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 font-bold"
            onClick={login}
          >
            Přihlásit
          </button>
        </div>
      </div>
    );
  }

  // APP
  return (
    <div className={`min-h-screen text-white ${
      adminMode
        ? "bg-gradient-to-br from-yellow-900 via-black to-yellow-900"
        : "bg-black"
    }`}>
      
      <TopBar
        user={user}
        logout={logout}
        setView={setView}
        adminMode={adminMode}
        setAdminMode={setAdminMode}
      />

      <div className="p-6 max-w-5xl mx-auto">
        {view === "races" && (
          <Races
            onSelect={(r) => { setRace(r); setView("race"); }}
            adminMode={adminMode}
          />
        )}

        {view === "race" && race && (
          <RaceDetail
            race={race}
            user={user}
            goBack={() => setView("races")}
            adminMode={adminMode}
          />
        )}

        {view === "leaderboard" && <LeaderboardTotal user={user} />}
      </div>
    </div>
  );
}

function TopBar({ user, logout, setView, adminMode, setAdminMode }) {
  const isAdmin = user?.role === "admin";

  return (
    <div className={`flex items-center justify-between px-6 py-4 border-b ${
      adminMode
        ? "bg-yellow-900 border-yellow-700"
        : "bg-zinc-950 border-zinc-800"
    }`}>

      <div className="text-red-500 font-black">
        🏎️ F1 TIPOVAČKA
      </div>

      <div className="flex gap-2">
        <button onClick={() => setView("races")} className="px-3 py-1 bg-zinc-800 rounded">
          Závody
        </button>
        <button onClick={() => setView("leaderboard")} className="px-3 py-1 bg-zinc-800 rounded">
          Leaderboard
        </button>
      </div>

      <div className="flex items-center gap-3">
        {isAdmin && (
          <button
            onClick={() => setAdminMode(!adminMode)}
            className={`px-3 py-1 rounded font-bold ${
              adminMode
                ? "bg-yellow-400 text-black"
                : "bg-red-600"
            }`}
          >
            ADMIN
          </button>
        )}

        <span>{user?.name}</span>

        <button onClick={logout}>🚪</button>
      </div>
    </div>
  );
}
function Races({ onSelect, adminMode }) {
  const [races, setRaces] = useState([]);
  const [newRace, setNewRace] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from("races")
      .select("*")
      .order("order_index", { ascending: true });

    setRaces(data || []);
  }

  async function addRace() {
    if (!newRace.trim()) return;

    const nextOrder = races.length + 1;

    await supabase.from("races").insert([
      {
        name: newRace.trim(),
        order_index: nextOrder,
      },
    ]);

    setNewRace("");
    load();
  }

  async function fixOrder() {
  const { data } = await supabase
    .from("races")
    .select("*")
    .order("order_index", { ascending: true });

  if (!data) return;

  for (let i = 0; i < data.length; i++) {
    await supabase
      .from("races")
      .update({ order_index: i + 1 })
      .eq("id", data[i].id);
  }
}

  async function deleteRace(id) {
  if (!confirm("Smazat závod?")) return;

  await supabase
    .from("races")
    .delete()
    .eq("id", id);

  await fixOrder(); // 🔥 TADY TO PATŘÍ

  load();
}

  // 🔥 FIX MOVE (HLAVNÍ OPRAVA)
  async function moveRace(index, direction) {
    const current = races[index];
    const target = races[index + direction];

    if (!target) return;

    // swap order_index
    await supabase
      .from("races")
      .update({ order_index: target.order_index })
      .eq("id", current.id);

    await supabase
      .from("races")
      .update({ order_index: current.order_index })
      .eq("id", target.id);

    load();
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">🏁 Závody</h1>

      {/* ADMIN */}
      {adminMode && (
        <div className="mb-6 p-4 rounded-xl bg-yellow-900/40 border border-yellow-700">
          <div className="flex gap-2">
            <input
              value={newRace}
              onChange={(e) => setNewRace(e.target.value)}
              placeholder="Nový závod"
              className="flex-1 px-3 py-2 rounded bg-black border border-zinc-700 text-white"
            />

            <button
              onClick={addRace}
              className="px-4 py-2 bg-yellow-500 text-black font-bold rounded"
            >
              ➕
            </button>
          </div>
        </div>
      )}

      {/* LIST */}
      <div className="grid gap-3">
        {races.map((r, i) => (
          <div
            key={r.id}
            className="p-4 rounded-xl bg-zinc-900 border border-zinc-800"
          >
            {/* CLICK */}
            <div onClick={() => onSelect(r)} className="cursor-pointer">
              <div className="font-bold text-red-500">
                Round {r.order_index}
              </div>

              <div>{r.name}</div>
            </div>

            {/* ADMIN ACTIONS */}
            {adminMode && (
              <div className="flex gap-2 mt-3">
                <button
                  disabled={i === 0}
                  onClick={() => moveRace(i, -1)}
                  className="px-2 bg-zinc-700 rounded disabled:opacity-30"
                >
                  ↑
                </button>

                <button
                  disabled={i === races.length - 1}
                  onClick={() => moveRace(i, 1)}
                  className="px-2 bg-zinc-700 rounded disabled:opacity-30"
                >
                  ↓
                </button>

                <button
                  onClick={() => deleteRace(r.id)}
                  className="px-2 bg-red-600 rounded"
                >
                  🗑
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
function RaceDetail({ race, user, goBack, adminMode }) {
  const [questions, setQuestions] = useState([]);
  const [tips, setTips] = useState({});
  const [players, setPlayers] = useState([]);
  const [newQuestion, setNewQuestion] = useState("");

  const isLocked = race.lock_time
    ? new Date().getTime() > new Date(race.lock_time).getTime()
    : false;

  useEffect(() => {
    load();

    const channel = supabase
      .channel("realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public" },
        () => load()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  async function load() {
    const { data: q } = await supabase
      .from("questions")
      .select("*")
      .eq("race_id", race.id)
      .order("id");

    const { data: t } = await supabase.from("tips").select("*");
    const { data: p } = await supabase.from("players").select("*");

    const grouped = {};
    t?.forEach((x) => {
      if (!grouped[x.question_id]) grouped[x.question_id] = [];
      grouped[x.question_id].push(x);
    });

    setQuestions(q || []);
    setTips(grouped);
    setPlayers(p || []);
  }

  async function sendTip(qid, answer) {
    if (isLocked && !adminMode) return;

    await supabase.from("tips").upsert(
      {
        player_id: user.id,
        question_id: qid,
        answer,
      },
      { onConflict: "player_id,question_id" }
    );

    load();
  }

  async function setCorrect(id, val) {
    if (!adminMode) return;

    await supabase
      .from("questions")
      .update({ correct_answer: val })
      .eq("id", id);

    load();
  }

  async function addQuestion() {
    if (!newQuestion.trim()) return;

    await supabase.from("questions").insert([
      {
        text: newQuestion.trim(),
        race_id: race.id,
        player_id: user.id,
      },
    ]);

    setNewQuestion("");
    load();
  }

  const myQuestions = questions.filter(q => q.player_id === user.id);

  return (
    <div>
      <button onClick={goBack} className="mb-4 text-zinc-400 hover:text-white">
        ← zpět
      </button>

      <h1 className="text-xl font-bold mb-2">{race.name}</h1>

      {isLocked && (
        <div className="mb-4 text-amber-400 text-sm">
          🔒 Tipování uzamčeno
        </div>
      )}

      {/* ADD QUESTION */}
      <div className="mb-6 p-4 rounded-xl bg-zinc-900 border border-zinc-800">
        <div className="flex gap-2">
          <input
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="Napiš otázku..."
            className="flex-1 px-3 py-2 rounded bg-black border border-zinc-700 text-white"
          />

          <button
            disabled={myQuestions.length >= 3}
            onClick={addQuestion}
            className={`px-4 py-2 rounded ${
              myQuestions.length >= 3
                ? "bg-zinc-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            ➕
          </button>
        </div>

        {myQuestions.length >= 3 && (
          <div className="text-xs text-zinc-400 mt-2">
            Max 3 otázky
          </div>
        )}
      </div>

      {/* LEADERBOARD */}
      <RaceLeaderboard
        questions={questions}
        tips={tips}
        players={players}
        user={user}
      />

      {/* QUESTIONS */}
      <div className="space-y-4">
        {questions.map((q) => {
          const list = tips[q.id] || [];

          return (
            <div key={q.id} className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">

              <div className="mb-2 font-semibold">{q.text}</div>

              <div className="flex gap-2 mb-3">
                <button
                  disabled={isLocked && !adminMode}
                  onClick={() => sendTip(q.id, "ANO")}
                  className={`px-3 py-1 rounded ${
                    isLocked ? "bg-zinc-700" : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  ANO
                </button>

                <button
                  disabled={isLocked && !adminMode}
                  onClick={() => sendTip(q.id, "NE")}
                  className={`px-3 py-1 rounded ${
                    isLocked ? "bg-zinc-700" : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  NE
                </button>
              </div>

              {adminMode && (
                <div className="flex gap-2 mb-2">
                  <button onClick={() => setCorrect(q.id, "ANO")} className="px-2 py-1 bg-green-700 rounded">
                    ANO
                  </button>
                  <button onClick={() => setCorrect(q.id, "NE")} className="px-2 py-1 bg-red-700 rounded">
                    NE
                  </button>
                  <button onClick={() => setCorrect(q.id, null)} className="px-2 py-1 bg-zinc-700 rounded">
                    RESET
                  </button>
                </div>
              )}

              <div className="text-sm text-zinc-400">
                {list.map((t, i) => {
                  const player = players.find(p => p.id === t.player_id);

                  return (
                    <div key={i} className="flex justify-between">
                      <span>{player?.name || "?"}</span>
                      <span>{t.answer}</span>
                    </div>
                  );
                })}
              </div>

              {q.correct_answer && (
                <div className="mt-2 text-green-400 text-sm">
                  ✔ {q.correct_answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RaceLeaderboard({ questions, tips, players, user }) {
  const scores = {};

  players.forEach((p) => {
    scores[p.id] = { id: p.id, name: p.name, points: 0 };
  });

  questions.forEach((q) => {
    if (!q.correct_answer) return;

    const list = tips[q.id] || [];

    const correctCount = list.filter(
      (t) => t.answer === q.correct_answer
    ).length;

    if (!correctCount) return;

    const points = players.length + 1 - correctCount;

    list.forEach((t) => {
      if (t.answer === q.correct_answer) {
        if (!scores[t.player_id]) return;
        scores[t.player_id].points += points;
      }
    });
  });

  const leaderboard = Object.values(scores).sort(
    (a, b) => b.points - a.points
  );

  return (
    <div className="mb-6 rounded-xl border border-zinc-800 overflow-hidden">
      <div className="px-4 py-3 bg-zinc-900 text-sm text-zinc-400">
        🏁 Pořadí závodu
      </div>

      {leaderboard.map((p, i) => {
        const isMe = p.id === user.id;

        return (
          <div
            key={p.id}
            className={`flex items-center justify-between px-4 py-2 border-t border-zinc-800 ${
              isMe ? "bg-green-900/30 text-green-400" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-6 text-center text-zinc-400 font-bold">
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
              </div>

              <div>{p.name}</div>
            </div>

            <div className="font-bold">
              {p.points} pts
            </div>
          </div>
        );
      })}
    </div>
  );
}
function LeaderboardTotal({ user }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: q } = await supabase.from("questions").select("*");
    const { data: t } = await supabase.from("tips").select("*");
    const { data: players } = await supabase.from("players").select("*");

    const scores = {};

    players.forEach((p) => {
      scores[p.id] = { id: p.id, name: p.name, points: 0 };
    });

    q?.forEach((qst) => {
      if (!qst.correct_answer) return;

      const list = t.filter((x) => x.question_id === qst.id);

      const correctCount = list.filter(
        (x) => x.answer === qst.correct_answer
      ).length;

      if (!correctCount) return;

      const points = players.length + 1 - correctCount;

      list.forEach((tip) => {
        if (tip.answer === qst.correct_answer) {
          if (!scores[tip.player_id]) return;
          scores[tip.player_id].points += points;
        }
      });
    });

    setData(
      Object.values(scores).sort((a, b) => b.points - a.points)
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">🏆 Leaderboard</h1>

      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        {data.map((p, i) => {
          const isMe = p.id === user.id;

          return (
            <div
              key={p.id}
              className={`flex items-center justify-between px-4 py-3 border-t border-zinc-800 ${
                isMe ? "bg-green-900/30 text-green-400" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-6 text-center text-zinc-400 font-bold">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                </div>

                <div>{p.name}</div>
              </div>

              <div className="font-bold">
                {p.points} pts
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
