import { useState, useEffect } from "react";
import { supabase } from "./supabase";

export default function RaceDetail({ race, user, goBack, adminMode }) {
  const [questions, setQuestions] = useState([]);
  const [tips, setTips] = useState({});
  const [players, setPlayers] = useState([]);
  const [newQuestion, setNewQuestion] = useState("");

  const isLocked =
    race.lock_time && new Date() > new Date(race.lock_time);

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

    const { data: t } = await supabase
      .from("tips")
      .select("*");

    const { data: p } = await supabase
      .from("players")
      .select("*");

    const grouped = {};
    t?.forEach((x) => {
      if (!grouped[x.question_id]) grouped[x.question_id] = [];
      grouped[x.question_id].push(x);
    });

    setQuestions(q || []);
    setTips(grouped);
    setPlayers(p || []);
  }

  // ✅ TIP
  async function sendTip(qid, answer) {
    if (isLocked) return;

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

  // ✅ ADMIN
  async function setCorrect(qid, val) {
    if (!adminMode) return;

    await supabase
      .from("questions")
      .update({ correct_answer: val })
      .eq("id", qid);

    load();
  }

  // ➕ otázka
  async function addQuestion() {
    if (!newQuestion) return;

    const myCount = questions.filter(q => q.player_id === user.id).length;
    if (myCount >= 3) {
      alert("Max 3 otázky");
      return;
    }

    await supabase.from("questions").insert([
      {
        text: newQuestion,
        race_id: race.id,
        player_id: user.id,
      },
    ]);

    setNewQuestion("");
    load();
  }

  function calculatePoints(list, correct) {
    if (!correct) return {};

    const correctCount = list.filter(t => t.answer === correct).length;
    if (!correctCount) return {};

    const points = players.length + 1 - correctCount;

    const map = {};
    list.forEach(t => {
      map[t.player_id] = t.answer === correct ? points : 0;
    });

    return map;
  }
    return (
    <div style={{ padding: "30px" }}>
      <button onClick={goBack}>← zpět</button>
      <h1>{race.name}</h1>

      {/* 🏆 LEADERBOARD */}
      <div style={{ marginBottom: 20 }}>
        <h3>🏁 Pořadí závodu</h3>

        {players.map((p) => {
          let points = 0;

          questions.forEach((q) => {
            if (!q.correct_answer) return;

            const list = tips[q.id] || [];
            const correctCount = list.filter(
              (x) => x.answer === q.correct_answer
            ).length;

            if (!correctCount) return;

            const pts = players.length + 1 - correctCount;

            const myTip = list.find((t) => t.player_id === p.id);

            if (myTip?.answer === q.correct_answer) {
              points += pts;
            }
          });

          return (
            <div key={p.id}>
              {p.name} - {points} bodů
            </div>
          );
        })}
      </div>

      {/* ➕ přidání otázky */}
      <div style={{ marginBottom: 20 }}>
        <input
          value={newQuestion}
          onChange={(e) => setNewQuestion(e.target.value)}
          placeholder="Nová otázka..."
        />
        <button onClick={addQuestion}>Přidat</button>
      </div>

      {/* ❓ otázky */}
      {questions.map((q) => {
        const list = tips[q.id] || [];
        const pointsMap = calculatePoints(list, q.correct_answer);

        return (
          <div
            key={q.id}
            style={{
              border: "1px solid #333",
              padding: 15,
              marginBottom: 15,
              borderRadius: 10,
            }}
          >
            <div style={{ fontWeight: "bold" }}>{q.text}</div>

            {/* TABULKA */}
            {players.map((p) => {
              const tip = list.find((t) => t.player_id === p.id);
              const isMe = p.id === user.id;

              return (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    background: isMe ? "#1a2a1a" : "transparent",
                    color: isMe ? "#4CAF50" : "white",
                  }}
                >
                  <span>{p.name}</span>
                  <span>{tip?.answer || "-"}</span>
                  <span>{pointsMap[p.id] ?? 0}</span>
                </div>
              );
            })}

            {/* 👇 TIPOVÁNÍ */}
            <div style={{ marginTop: 10 }}>
              <button onClick={() => sendTip(q.id, "ANO")}>
                ANO
              </button>
              <button onClick={() => sendTip(q.id, "NE")}>
                NE
              </button>
            </div>

            {/* 👇 ADMIN */}
            <div style={{ marginTop: 10 }}>
              <div>
                {q.correct_answer
                  ? `Výsledek: ${q.correct_answer}`
                  : "Nevyhodnoceno"}
              </div>

              {adminMode && (
                <>
                  <button onClick={() => setCorrect(q.id, "ANO")}>
                    ANO
                  </button>
                  <button onClick={() => setCorrect(q.id, "NE")}>
                    NE
                  </button>
                  <button onClick={() => setCorrect(q.id, null)}>
                    RESET
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}