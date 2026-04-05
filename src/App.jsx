import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import logoHero from "./assets/logo-hero.png";
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor
} from "@dnd-kit/core";

import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";

// Apple-level polish: subtle animations and interactions
const styles = `
@keyframes fadeInLogo {
  from { opacity: 0; transform: translateY(10px) scale(0.98); }
  to { opacity: 0.95; transform: translateY(0) scale(1); }
}
.animate-fadeInLogo {
  animation: fadeInLogo 0.8s cubic-bezier(0.65,0,0.35,1) forwards;
}
@keyframes fadeInPage {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fadeInPage {
  animation: fadeInPage 0.4s ease-out;
}
@keyframes toastPop {
  0% { opacity: 0; transform: translateY(10px) scale(0.95); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
.animate-toastPop {
  animation: toastPop 0.25s ease-out;
}
@keyframes slideLeft {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(-40px); opacity: 0; }
}
@keyframes slideRight {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(40px); opacity: 0; }
}
@keyframes slideIn {
  from { transform: translateX(40px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
.animate-slideLeft { animation: slideLeft 0.25s ease-out; }
.animate-slideRight { animation: slideRight 0.25s ease-out; }
.animate-slideIn { animation: slideIn 0.3s ease-out; }
@keyframes pulseSuccess {
  0% { transform: scale(1); box-shadow: 0 0 0 rgba(34,197,94,0.4); }
  50% { transform: scale(1.08); box-shadow: 0 0 18px rgba(34,197,94,0.6); }
  100% { transform: scale(1); box-shadow: 0 0 0 rgba(34,197,94,0); }
}
@keyframes pulseDanger {
  0% { transform: scale(1); box-shadow: 0 0 0 rgba(239,68,68,0.4); }
  50% { transform: scale(1.08); box-shadow: 0 0 18px rgba(239,68,68,0.6); }
  100% { transform: scale(1); box-shadow: 0 0 0 rgba(239,68,68,0); }
}
@keyframes numberTick {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-numberTick {
  animation: numberTick 0.25s ease-out;
}
.animate-pulseSuccess {
  animation: pulseSuccess 0.35s ease;
}
.animate-pulseDanger {
  animation: pulseDanger 0.35s ease;
}
@keyframes glassFlash {
  0% { opacity: 0; backdrop-filter: blur(0px); }
  50% { opacity: 1; backdrop-filter: blur(12px); }
  100% { opacity: 0; backdrop-filter: blur(0px); }
}
.glass-flash-overlay {
  position: fixed;
  inset: 0;
  background: radial-gradient(circle at center, rgba(255,255,255,0.08), transparent 60%);
  pointer-events: none;
  z-index: 9999;
  animation: glassFlash 0.5s ease-out;
}
`;

export default function App() {
  const [code, setCode] = useState(["", "", "", ""]);
  const [error, setError] = useState(false);
  const [user, setUser] = useState(null);
  const [race, setRace] = useState(null);
  const [view, setView] = useState("races");
  const [adminMode, setAdminMode] = useState(false);
  const [pageAnim, setPageAnim] = useState("animate-slideIn");

  // --- Swipe handling ---
  let touchStartX = 0;
  let touchEndX = 0;

  function handleTouchStart(e) {
    touchStartX = e.changedTouches[0].screenX;
  }

  function playClick() {
    const audio = new window.Audio("https://actions.google.com/sounds/v1/ui/click.ogg");
    audio.volume = 0.2;
    audio.play();
  }

  function handleTouchEnd(e) {
    touchEndX = e.changedTouches[0].screenX;
    const diff = touchStartX - touchEndX;

    if (Math.abs(diff) < 60) return;

    if (diff > 0) {
      // swipe left
      if (view === "races") {
        setPageAnim("animate-slideLeft");
        setTimeout(() => {
          setView("leaderboard");
          setPageAnim("animate-slideIn");
          playClick();
          haptic();
        }, 200);
      }
    } else {
      // swipe right
      if (view === "leaderboard") {
        setPageAnim("animate-slideRight");
        setTimeout(() => {
          setView("races");
          setPageAnim("animate-slideIn");
          playClick();
          haptic();
        }, 200);
      }
    }
  }

  // --- Haptic feedback helper ---
  function haptic() {
    if (navigator.vibrate) navigator.vibrate(10);
  }

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
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center px-6">
        <style>{styles}</style>

        {/* LOGO */}
        <img
          src={logoHero}
          className="w-[380px] mb-12 drop-shadow-[0_0_20px_rgba(255,255,255,0.15)] opacity-0 animate-fadeInLogo hover:scale-[1.02]"
        />

        {/* CARD */}
        <div className={`w-full max-w-sm p-8 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 ${error ? "animate-shake" : ""}`}>

          {/* PIN INPUT */}
          <div className="flex justify-center gap-3 mb-6">
            {code.map((digit, i) => (
              <input
                key={i}
                id={`pin-${i}`}
                type="password"
                inputMode="numeric"
                maxLength={1}
                autoFocus={i === 0}
                value={digit}
                className="w-14 h-14 text-center text-2xl rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/40 transition duration-200 active:scale-95 focus:scale-105 caret-transparent"
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
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !code[i] && i > 0) {
                    document.getElementById(`pin-${i - 1}`)?.focus();
                  }
                }}
              />
            ))}
          </div>

          {/* ERROR */}
          {error && (
            <div className="text-red-400 text-center mb-4 text-sm">
              Neplatný kód
            </div>
          )}

          {/* BUTTON */}
          <button
            className="w-full py-3 rounded-xl bg-white text-black font-semibold transition duration-200 hover:bg-zinc-200 hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-95"
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
    <div
      className="min-h-screen text-white pb-20 bg-black"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <style>{styles}</style>
      <TopBar
        user={user}
        logout={logout}
        setView={setView}
        view={view}
        adminMode={adminMode}
        setAdminMode={setAdminMode}
        haptic={haptic}
        playClick={playClick}
      />

      <div className={`p-4 md:p-6 max-w-5xl mx-auto ${pageAnim}`}>
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
        {view === "admin-data" && <AdminData />}
      </div>
    </div>
  );
}

function TopBar({ user, logout, setView, view, adminMode, setAdminMode, haptic, playClick }) {
  const isAdmin = user?.role === "admin";

  return (
    <div className="flex items-center justify-between px-4 md:px-8 py-5 md:py-6 border-b border-zinc-800 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="flex items-center">
        <img
          src={logoHero}
          className="w-[96px] h-auto opacity-90 transition duration-300 transform hover:scale-105 hover:drop-shadow-[0_0_20px_rgba(255,255,255,0.25)]"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => { haptic(); playClick(); setView("races"); }}
          className={`px-3 py-1.5 rounded-lg transition duration-200 text-sm border backdrop-blur active:scale-95 hover:-translate-y-[1px] ${
            view === "races"
              ? "bg-white text-black border-white shadow-[0_0_12px_rgba(255,255,255,0.25)]"
              : "bg-zinc-900/70 hover:bg-zinc-800/80 border-zinc-800/70"
          }`}
        >
          Závody
        </button>
        <button
          onClick={() => { haptic(); playClick(); setView("leaderboard"); }}
          className={`px-3 py-1.5 rounded-lg transition duration-200 text-sm border backdrop-blur active:scale-95 hover:-translate-y-[1px] ${
            view === "leaderboard"
              ? "bg-white text-black border-white shadow-[0_0_12px_rgba(255,255,255,0.25)]"
              : "bg-zinc-900/70 hover:bg-zinc-800/80 border-zinc-800/70"
          }`}
        >
          Leaderboard
        </button>
        {isAdmin && adminMode && (
          <button
            onClick={() => setView("admin-data")}
            className="px-3 py-1.5 bg-zinc-900/70 hover:bg-zinc-800/80 hover:shadow-[0_0_12px_rgba(255,255,255,0.15)] rounded-lg transition duration-200 text-sm border border-zinc-800/70 backdrop-blur active:scale-95 hover:-translate-y-[1px]"
          >
            Správa dat
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        {isAdmin && (
          <button
            onClick={() => setAdminMode(!adminMode)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition active:scale-95 border ${
              adminMode
                ? "bg-white text-black border-white"
                : "bg-zinc-900/70 text-white border-zinc-700"
            }`}
          >
            ADMIN
          </button>
        )}

        <span>{user?.name}</span>

        <button
          onClick={() => { haptic(); logout(); }}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-zinc-900/70 border border-zinc-700 hover:bg-red-600/80 hover:border-red-500 hover:shadow-[0_0_14px_rgba(239,68,68,0.4)] transition duration-200 active:scale-95"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v10" />
            <path d="M6.2 6.2a8 8 0 1 0 11.6 0" />
          </svg>
        </button>
      </div>
    </div>
  );
}
function Races({ onSelect, adminMode }) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5
      }
    })
  );
  const [lockTime, setLockTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editingRace, setEditingRace] = useState(null);

  function SortableItem({ r, i }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging
    } = useSortable({
      id: r.id,
      disabled: !adminMode
    });

    const style = {
      transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      transition,
      opacity: isDragging ? 0.5 : 1
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...(adminMode ? listeners : {})}
        className={`p-4 rounded-xl bg-zinc-900/70 backdrop-blur-xl border border-zinc-800/70 hover:border-zinc-600 transition duration-200 relative overflow-hidden active:scale-[0.98] hover:-translate-y-[1px] ${adminMode ? "cursor-grab active:cursor-grabbing" : ""}`}
        onClick={() => onSelect(r)}
      >
        <div className="cursor-pointer">
          <div className="font-bold text-red-500 flex items-center gap-2">
            {r.type === "season" ? "🏆 Sezónní tipy" : `Round ${r.order_index}`}
            {r.lock_time && r.end_time && (
              new Date() >= new Date(r.lock_time) && new Date() <= new Date(r.end_time)
            ) && (
              <span className="text-xs text-green-400">LIVE</span>
            )}
          </div>
          {r.type !== "season" && <div>{r.name}</div>}
        </div>

        {adminMode && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={(e) => { e.stopPropagation(); setEditingRace(r); }}
              className="px-2 bg-zinc-700 rounded"
            >
              ✏️
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); deleteRace(r.id); }}
              className="px-2 bg-red-600 rounded"
            >
              🗑
            </button>
          </div>
        )}
      </div>
    );
  }
  const [races, setRaces] = useState([]);
  const [newRace, setNewRace] = useState("");

  // Validation logic
  const isNameValid = newRace.trim().length > 0;
  const isTimeFilled = !!lockTime && !!endTime;
  const isTimeValid = isTimeFilled && new Date(endTime) >= new Date(lockTime);

  function handleDragEnd(event) {
    if (!adminMode) return;
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = races.findIndex(r => r.id === active.id);
    const newIndex = races.findIndex(r => r.id === over.id);

    // nepovol přesun "season"
    if (races[oldIndex].type === "season" || races[newIndex].type === "season") return;

    const newOrder = arrayMove(races, oldIndex, newIndex);

    // 🔥 přepočítat pořadí jen pro klasické závody
    let orderCounter = 1;
    const updatedOrder = newOrder.map((race) => {
      if (race.type === "season") return race;

      return {
        ...race,
        order_index: orderCounter++
      };
    });

    setRaces(updatedOrder);

    // 🔥 uložit nové pořadí do DB (jen non-season)
    updatedOrder.forEach(async (race) => {
      if (race.type === "season") return;

      await supabase
        .from("races")
        .update({ order_index: race.order_index })
        .eq("id", race.id);
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from("races")
      .select("*")
      .order("order_index", { ascending: true });

    // Debug log to confirm data from DB
    console.log("LOADED RACES:", data);

    setRaces(
      (data || []).sort((a, b) => {
        if (a.type === "season") return -1;
        if (b.type === "season") return 1;
        return a.order_index - b.order_index;
      })
    );
  }

  async function addRace() {
    if (!newRace.trim()) return;
    if (lockTime && endTime && new Date(endTime) < new Date(lockTime)) return;

    const normalRaces = races.filter(r => r.type !== "season");
    const nextOrder = normalRaces.length + 1;

    // Debugging: log lockTime and endTime before insert
    console.log("SAVING:", lockTime, endTime);
    if (!lockTime && !endTime) {
      console.warn("⚠️ Časy nejsou vyplněné");
    }

    const { error } = await supabase.from("races").insert([
      {
        name: newRace.trim(),
        order_index: nextOrder,
        lock_time: lockTime ? new Date(lockTime).toISOString() : null,
        end_time: endTime ? new Date(endTime).toISOString() : null
      },
    ]);

    if (error) {
      console.error("❌ INSERT ERROR:", error);
    }

    setNewRace("");
    setLockTime("");
    setEndTime("");
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
    setConfirmDelete(id);
  }

  async function confirmDeleteRace() {
    if (!confirmDelete) return;

    await supabase
      .from("races")
      .delete()
      .eq("id", confirmDelete);

    await fixOrder();
    setConfirmDelete(null);
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
          <div className="flex flex-col gap-2">
            <div className="grid gap-2">
              <div className="text-xs text-zinc-400">🏎️ Název závodu</div>
              <div className="flex gap-2">
                <input
                  value={newRace}
                  onChange={(e) => setNewRace(e.target.value)}
                  placeholder="Např. Austrálie GP"
                  className="flex-1 px-3 py-2 rounded bg-zinc-900/70 border border-zinc-700/70 text-white focus:outline-none focus:ring-1 focus:ring-white/40"
                />
                <button
                  onClick={addRace}
                  disabled={!isNameValid || !isTimeValid}
                  className={`px-4 py-2 rounded-lg font-bold border transition active:scale-95 ${
                    !isNameValid || !isTimeValid
                      ? "bg-zinc-700 text-zinc-400 border-zinc-600"
                      : "bg-yellow-500 text-black border-yellow-400/40 hover:bg-yellow-400"
                  }`}
                >
                  ➕
                </button>
              </div>
              {/* Name validation message */}
              {!isNameValid && (
                <div className="text-xs text-red-400 mt-1">Zadej název závodu</div>
              )}
            </div>
            <div className="grid gap-3 mt-2">
              <div>
                <div className="text-xs text-zinc-400 mb-1">🔒 Uzávěrka tipování</div>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={lockTime?.split("T")[0] || ""}
                    onChange={(e) => {
                      const time = lockTime?.split("T")[1] || "00:00";
                      setLockTime(`${e.target.value}T${time}`);
                    }}
                    className="flex-1 px-3 py-2 rounded bg-zinc-900/70 border border-zinc-700 text-white"
                  />
                  <input
                    type="time"
                    value={lockTime?.split("T")[1] || ""}
                    onChange={(e) => {
                      const date = lockTime?.split("T")[0] || "";
                      setLockTime(`${date}T${e.target.value}`);
                    }}
                    className="w-32 px-3 py-2 rounded bg-zinc-900/70 border border-zinc-700 text-white"
                  />
                </div>
                <div className="text-xs text-zinc-500 mt-1">Po tomto čase už nelze tipovat</div>
              </div>
              <div>
                <div className="text-xs text-zinc-400 mb-1">📡 Konec LIVE fáze závodu</div>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={endTime?.split("T")[0] || ""}
                    onChange={(e) => {
                      const time = endTime?.split("T")[1] || "00:00";
                      setEndTime(`${e.target.value}T${time}`);
                    }}
                    className="flex-1 px-3 py-2 rounded bg-zinc-900/70 border border-zinc-700 text-white"
                  />
                  <input
                    type="time"
                    value={endTime?.split("T")[1] || ""}
                    onChange={(e) => {
                      const date = endTime?.split("T")[0] || "";
                      setEndTime(`${date}T${e.target.value}`);
                    }}
                    className="w-32 px-3 py-2 rounded bg-zinc-900/70 border border-zinc-700 text-white"
                  />
                </div>
                <div className="text-xs text-zinc-500 mt-1">Do tohoto času bude závod označen jako LIVE</div>
              </div>
              {/* Time validation message */}
              {!isTimeFilled && (
                <div className="text-xs text-red-400 mt-2">Vyplň oba časy</div>
              )}
              {isTimeFilled && !isTimeValid && (
                <div className="text-xs text-red-400 mt-2">Konec závodu musí být po uzávěrce tipování</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* LIST */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={races.map(r => r.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="grid gap-3">
            {races.map((r, i) => (
              <SortableItem key={r.id} r={r} i={i} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* EDIT MODAL */}
      {editingRace && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 w-[320px]">
            <h2 className="mb-4 font-semibold">Upravit závod</h2>

            <input
              value={editingRace.name}
              onChange={(e) => setEditingRace({ ...editingRace, name: e.target.value })}
              className="w-full mb-3 px-3 py-2 rounded bg-zinc-900/70 border border-zinc-700 text-white"
            />

            <div className="mb-3">
              <div className="text-xs text-zinc-400 mb-1">🔒 Uzávěrka tipování</div>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={editingRace.lock_time?.split("T")[0] || ""}
                  onChange={(e) => {
                    const time = editingRace.lock_time?.split("T")[1] || "00:00";
                    setEditingRace({ ...editingRace, lock_time: `${e.target.value}T${time}` });
                  }}
                  className="flex-1 px-3 py-2 rounded bg-zinc-900/70 border border-zinc-700 text-white"
                />
                <input
                  type="time"
                  value={editingRace.lock_time?.split("T")[1] || ""}
                  onChange={(e) => {
                    const date = editingRace.lock_time?.split("T")[0] || "";
                    setEditingRace({ ...editingRace, lock_time: `${date}T${e.target.value}` });
                  }}
                  className="w-32 px-3 py-2 rounded bg-zinc-900/70 border border-zinc-700 text-white"
                />
              </div>
            </div>
            <div className="mb-4">
              <div className="text-xs text-zinc-400 mb-1">📡 Konec LIVE fáze závodu</div>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={editingRace.end_time?.split("T")[0] || ""}
                  onChange={(e) => {
                    const time = editingRace.end_time?.split("T")[1] || "00:00";
                    setEditingRace({ ...editingRace, end_time: `${e.target.value}T${time}` });
                  }}
                  className="flex-1 px-3 py-2 rounded bg-zinc-900/70 border border-zinc-700 text-white"
                />
                <input
                  type="time"
                  value={editingRace.end_time?.split("T")[1] || ""}
                  onChange={(e) => {
                    const date = editingRace.end_time?.split("T")[0] || "";
                    setEditingRace({ ...editingRace, end_time: `${date}T${e.target.value}` });
                  }}
                  className="w-32 px-3 py-2 rounded bg-zinc-900/70 border border-zinc-700 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditingRace(null)}
                className="px-3 py-1 bg-zinc-700 rounded"
              >
                Zrušit
              </button>
              <button
                onClick={async () => {
                  await supabase
                    .from("races")
                    .update({
                      name: editingRace.name,
                      lock_time: editingRace.lock_time ? new Date(editingRace.lock_time).toISOString() : null,
                      end_time: editingRace.end_time ? new Date(editingRace.end_time).toISOString() : null
                    })
                    .eq("id", editingRace.id);

                  setEditingRace(null);
                  load();
                }}
                className="px-3 py-1 bg-green-600 rounded"
              >
                Uložit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 w-[280px] text-center">
            <div className="mb-4">Opravdu smazat závod?</div>

            <div className="flex justify-center gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-3 py-1 bg-zinc-700 rounded"
              >
                Ne
              </button>
              <button
                onClick={confirmDeleteRace}
                className="px-3 py-1 bg-red-600 rounded"
              >
                Ano
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function RaceDetail({ race, user, goBack, adminMode }) {
  const [questions, setQuestions] = useState([]);
  const [tips, setTips] = useState({});
  const [players, setPlayers] = useState([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [questionType, setQuestionType] = useState("boolean");
  const [drivers, setDrivers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [toast, setToast] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  // --- Admin question controls ---
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [confirmDeleteQ, setConfirmDeleteQ] = useState(null);
  // glass flash overlay state
  const [glassFlash, setGlassFlash] = useState(false);

  const isLocked = race.lock_time
    ? new Date().getTime() > new Date(race.lock_time).getTime()
    : false;
  const isSeason = race.type === "season";

  useEffect(() => {
    if (!race.lock_time) return;

    const interval = setInterval(() => {
      const diff = new Date(race.lock_time).getTime() - new Date().getTime();

      if (diff <= 0) {
        setTimeLeft(null);
        clearInterval(interval);
      } else {
        const h = Math.floor(diff / 1000 / 60 / 60);
        const m = Math.floor((diff / 1000 / 60) % 60);
        const s = Math.floor((diff / 1000) % 60);

        setTimeLeft(
          `${h.toString().padStart(2,"0")}:${m.toString().padStart(2,"0")}:${s.toString().padStart(2,"0")}`
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [race.lock_time]);

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
    const { data: d } = await supabase.from("drivers").select("*").order("name");
    const { data: tm } = await supabase.from("teams").select("*").order("name");

    const grouped = {};
    t?.forEach((x) => {
      if (!grouped[x.question_id]) grouped[x.question_id] = [];
      grouped[x.question_id].push(x);
    });

    setQuestions(q || []);
    setTips(grouped);
    setPlayers(p || []);
    setDrivers(d || []);
    setTeams(tm || []);
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

    setToast("Uloženo");
    setTimeout(() => setToast(null), 1500);

    load();
  }

  async function setCorrect(id, val) {
    if (!adminMode) return;

    const el = document.getElementById(`q-${id}`);
    if (el) {
      el.classList.remove("animate-pulseSuccess", "animate-pulseDanger");
      void el.offsetWidth;
      el.classList.add(val === "ANO" ? "animate-pulseSuccess" : val === "NE" ? "animate-pulseDanger" : "");
    }

    // trigger glass effect
    setGlassFlash(true);
    setTimeout(() => setGlassFlash(false), 500);

    await supabase
      .from("questions")
      .update({ correct_answer: val })
      .eq("id", id);

    load();
  }

  async function setPoints(tipId, pts) {
    await supabase
      .from("tips")
      .update({ points: Number(pts) })
      .eq("id", tipId);

    load();
  }

  async function addQuestion() {
    if (!newQuestion.trim()) return;

    await supabase.from("questions").insert([
      {
        text: newQuestion.trim(),
        race_id: race.id,
        player_id: user.id,
        type: isSeason ? questionType : "boolean"
      },
    ]);

    setNewQuestion("");
    load();
  }

  const myQuestions = questions.filter(q => q.player_id === user.id);

  return (
    <div>
      {glassFlash && <div className="glass-flash-overlay" />}
      <button onClick={goBack} className="mb-4 text-zinc-400 hover:text-white">
        ← zpět
      </button>

      <h1 className="text-xl font-bold mb-2">{race.name}</h1>
      {timeLeft && (
        <div className="mb-2 text-sm text-yellow-400">
          ⏳ Tipování končí za {timeLeft}
        </div>
      )}
      {adminMode && (
        <input
          type="datetime-local"
          className="mb-3 px-3 py-2 rounded bg-zinc-900/70 border border-zinc-700/70 text-white focus:outline-none focus:ring-1 focus:ring-white/40"
          onChange={async (e) => {
            await supabase
              .from("races")
              .update({ lock_time: e.target.value })
              .eq("id", race.id);
          }}
        />
      )}

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
            className="flex-1 px-3 py-2 rounded bg-zinc-900/70 border border-zinc-700/70 text-white focus:outline-none focus:ring-1 focus:ring-white/40"
          />
          {isSeason && (
            <select
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value)}
              className="px-3 py-2 rounded-lg bg-zinc-900/70 border border-zinc-700/70 text-white backdrop-blur focus:outline-none focus:ring-1 focus:ring-white/40"
            >
              <option value="boolean">ANO / NE</option>
              <option value="driver">JEZDEC</option>
              <option value="team">TÝM</option>
            </select>
          )}
          <button
            disabled={!isSeason && myQuestions.length >= 3}
            onClick={addQuestion}
            className={`px-4 py-2 rounded-lg ${
              !isSeason && myQuestions.length >= 3
                ? "bg-zinc-700"
                : "bg-red-600/90 hover:bg-red-500/90 border border-red-500/30 transition active:scale-95"
            }`}
          >
            ➕
          </button>
        </div>

        {!isSeason && myQuestions.length >= 3 && (
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
          // Determine if edit/delete should be disabled for this question
          const disableEdit = !adminMode && isLocked;

          return (
            <div
              id={`q-${q.id}`}
              key={q.id}
              className="p-4 rounded-xl bg-zinc-900/70 backdrop-blur-xl border border-zinc-800/70 transition relative overflow-hidden active:scale-[0.98] hover:-translate-y-[1px]"
            >
              <div className="mb-3 flex justify-between items-start">
                <div>
                  <div className="font-semibold">
                    {editingQuestionId === q.id ? (
                      <input
                        value={editingText}
                        disabled={!adminMode && isLocked}
                        onChange={(e) => setEditingText(e.target.value)}
                        onBlur={async () => {
                          if (!editingText.trim()) return;
                          if (!adminMode && isLocked) return;
                          await supabase
                            .from("questions")
                            .update({ text: editingText.trim() })
                            .eq("id", q.id);
                          setEditingQuestionId(null);
                          load();
                        }}
                        className="flex-1 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-white disabled:opacity-50"
                        autoFocus
                      />
                    ) : (
                      q.text
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    Autor: {players.find(p => p.id === q.player_id)?.name || "?"}
                  </div>
                </div>

                {adminMode && (
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wide">
                      Admin
                    </div>
                    <div className="flex gap-2 bg-zinc-800/50 px-2 py-1 rounded-lg border border-zinc-700">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingQuestionId(q.id);
                          setEditingText(q.text);
                        }}
                        className="px-2 py-1 text-xs bg-zinc-700 rounded hover:bg-zinc-600"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteQ(q.id);
                        }}
                        className="px-2 py-1 text-xs bg-red-600 rounded hover:bg-red-500"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {q.type === "boolean" ? (
                <div className="flex gap-2 mb-3">
                  <button
                    disabled={isLocked && !adminMode}
                    onClick={() => sendTip(q.id, "ANO")}
                    className={`px-3 py-1 rounded-lg border transition active:scale-95 ${
                      list.find(t => t.player_id === user.id)?.answer === "ANO"
                        ? "bg-white text-black border-white"
                        : "bg-zinc-800/80 hover:bg-zinc-700/80 border-zinc-700/70"
                    } ${isLocked && !adminMode ? "opacity-40 pointer-events-none" : ""}`}
                  >
                    ANO
                  </button>
                  <button
                    disabled={isLocked && !adminMode}
                    onClick={() => sendTip(q.id, "NE")}
                    className={`px-3 py-1 rounded-lg border transition active:scale-95 ${
                      list.find(t => t.player_id === user.id)?.answer === "NE"
                        ? "bg-white text-black border-white"
                        : "bg-zinc-800/80 hover:bg-zinc-700/80 border-zinc-700/70"
                    } ${isLocked && !adminMode ? "opacity-40 pointer-events-none" : ""}`}
                  >
                    NE
                  </button>
                </div>
              ) : q.type === "driver" ? (
                <select
                  value={list.find(t => t.player_id === user.id)?.answer || ""}
                  className="px-3 py-1 rounded-lg bg-zinc-900/70 border border-zinc-700/70 text-white backdrop-blur focus:outline-none focus:ring-1 focus:ring-white/40"
                  onChange={(e) => sendTip(q.id, e.target.value)}
                  disabled={isLocked && !adminMode}
                  style={isLocked && !adminMode ? { opacity: 0.4, pointerEvents: "none" } : {}}
                >
                  <option value="">Vyber jezdce</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              ) : q.type === "team" ? (
                <select
                  value={list.find(t => t.player_id === user.id)?.answer || ""}
                  className="px-3 py-1 rounded-lg bg-zinc-900/70 border border-zinc-700/70 text-white backdrop-blur focus:outline-none focus:ring-1 focus:ring-white/40"
                  onChange={(e) => sendTip(q.id, e.target.value)}
                  disabled={isLocked && !adminMode}
                  style={isLocked && !adminMode ? { opacity: 0.4, pointerEvents: "none" } : {}}
                >
                  <option value="">Vyber tým</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              ) : null}

              {adminMode && (
                <div className="mt-4 p-3 rounded-xl bg-zinc-800/50 border border-zinc-700 flex items-center justify-between">
                  <div className="text-xs text-zinc-400 uppercase tracking-wide">
                    Vyhodnocení události
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setCorrect(q.id, "ANO")}
                      className="px-3 py-1 rounded-lg bg-green-700 hover:bg-green-600 text-sm transition active:scale-95 hover:shadow-[0_0_12px_rgba(34,197,94,0.5)]"
                    >
                      ANO
                    </button>
                    <button
                      onClick={() => setCorrect(q.id, "NE")}
                      className="px-3 py-1 rounded-lg bg-red-700 hover:bg-red-600 text-sm transition active:scale-95 hover:shadow-[0_0_12px_rgba(239,68,68,0.5)]"
                    >
                      NE
                    </button>
                    <button
                      onClick={() => setCorrect(q.id, null)}
                      className="px-3 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-sm transition active:scale-95 hover:shadow-[0_0_10px_rgba(255,255,255,0.2)]"
                    >
                      RESET
                    </button>
                  </div>
                </div>
              )}

              <div className="text-sm text-zinc-400">
                {list.map((t, i) => {
                  const isMe = t.player_id === user.id;
                  const player = players.find(p => p.id === t.player_id);

                  return (
                    <div key={i} className={`flex justify-between ${isMe ? "text-green-400" : ""}`}>
                      <span>{player?.name || "?"}</span>
                      <span>{t.answer}</span>
                      {adminMode && isSeason && (
                        <input
                          type="number"
                          placeholder="body"
                          className="ml-2 w-16 bg-zinc-900/70 border border-zinc-700/70 text-white rounded px-1 focus:outline-none focus:ring-1 focus:ring-white/40"
                          onBlur={(e) => setPoints(t.id, e.target.value)}
                        />
                      )}
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
      {toast && (
        <div className="fixed bottom-5 right-5 bg-white/90 text-black px-4 py-2 rounded-lg backdrop-blur shadow-md animate-toastPop">
          {toast}
        </div>
      )}

      {/* Custom DELETE modal for questions */}
      {confirmDeleteQ && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 w-[300px] text-center">
            <div className="mb-4">Smazat tuto otázku?</div>
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setConfirmDeleteQ(null)}
                className="px-3 py-1 bg-zinc-700 rounded"
              >
                Ne
              </button>
              <button
                onClick={async () => {
                  await supabase
                    .from("questions")
                    .delete()
                    .eq("id", confirmDeleteQ);
                  setConfirmDeleteQ(null);
                  load();
                }}
                className="px-3 py-1 bg-red-600 rounded"
              >
                Ano
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RaceLeaderboard({ questions, tips, players, user }) {
  const scores = {};

  players.forEach((p) => {
    scores[p.id] = { id: p.id, name: p.name, points: 0 };
  });

  questions.forEach((q) => {
    if (!q.correct_answer && q.type === "boolean") return;

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
    <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/80 overflow-hidden backdrop-blur-xl">
      <div className="px-4 py-3 bg-zinc-900/80 text-sm text-zinc-400 border-b border-zinc-800">
        🏁 Pořadí závodu
      </div>

      {leaderboard.map((p, i) => {
        const isMe = p.id === user.id;

        return (
          <div
            key={p.id}
            className={`flex items-center justify-between px-4 py-2 border-t border-zinc-800 hover:bg-zinc-800/40 hover:border-zinc-700 border border-transparent transition active:scale-[0.99] ${
              isMe ? "bg-green-900/30 text-green-400" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-6 text-center text-zinc-400 font-bold">
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
              </div>

              <div>{p.name}</div>
            </div>

            <div className="font-bold animate-numberTick">
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

    // Move seasonTips block above q?.forEach
    const seasonTips = t.filter(x => x.points);
    seasonTips.forEach(tip => {
      if (!scores[tip.player_id]) return;
      scores[tip.player_id].points += tip.points || 0;
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

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 overflow-hidden backdrop-blur-xl">
        {data.map((p, i) => {
          const isMe = p.id === user.id;

          return (
            <div
              key={p.id}
            className={`flex items-center justify-between px-4 py-3 border-t border-zinc-800 hover:bg-zinc-800/40 hover:border-zinc-700 border border-transparent transition active:scale-[0.99] ${
                isMe ? "bg-green-900/30 text-green-400" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-6 text-center text-zinc-400 font-bold">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                </div>

                <div>{p.name}</div>
              </div>

              <div className="font-bold animate-numberTick">
                {p.points} pts
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function AdminData() {
  const [drivers, setDrivers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [newDriver, setNewDriver] = useState("");
  const [newTeam, setNewTeam] = useState("");
  const [tab, setTab] = useState("drivers");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: d } = await supabase.from("drivers").select("*").order("name");
    const { data: t } = await supabase.from("teams").select("*").order("name");

    setDrivers(d || []);
    setTeams(t || []);
  }

  async function addDriver() {
    if (!newDriver.trim()) return;

    await supabase.from("drivers").insert([{ name: newDriver.trim() }]);
    setNewDriver("");
    load();
  }

  async function deleteDriver(id) {
    await supabase.from("drivers").delete().eq("id", id);
    load();
  }

  async function addTeam() {
    if (!newTeam.trim()) return;

    await supabase.from("teams").insert([{ name: newTeam.trim() }]);
    setNewTeam("");
    load();
  }

  async function deleteTeam(id) {
    await supabase.from("teams").delete().eq("id", id);
    load();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-xl font-bold">⚙️ Správa dat</h1>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("drivers")}
          className={`px-3 py-1.5 rounded-lg text-sm border transition ${
            tab === "drivers" ? "bg-white text-black border-white" : "bg-zinc-900/70 border-zinc-700"
          }`}
        >
          🏎️ Jezdci
        </button>
        <button
          onClick={() => setTab("teams")}
          className={`px-3 py-1.5 rounded-lg text-sm border transition ${
            tab === "teams" ? "bg-white text-black border-white" : "bg-zinc-900/70 border-zinc-700"
          }`}
        >
          🏁 Týmy
        </button>
      </div>

      {tab === "drivers" && (
      <>
      <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">🏎️ Jezdci</h2>
          <span className="text-xs text-zinc-500">{drivers.length} položek</span>
        </div>

        <div className="flex gap-2 mb-4">
          <input
            value={newDriver}
            onChange={(e) => setNewDriver(e.target.value)}
            placeholder="Nový jezdec"
            className="flex-1 px-3 py-2 bg-zinc-900/70 border border-zinc-700/70 text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-white/40"
          />
          <button onClick={addDriver} className="px-3 py-1 rounded-lg bg-green-600/90 hover:bg-green-500/90 border border-green-500/30 transition active:scale-95">➕</button>
        </div>

        {drivers.map((d) => (
          <div
            key={d.id}
            className="flex items-center justify-between bg-zinc-900/60 p-3 rounded-lg mb-2 border border-zinc-800 hover:bg-zinc-800/40 transition"
          >
            {editingId === d.id ? (
              <input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={async () => {
                  await supabase.from("drivers").update({ name: editValue }).eq("id", d.id);
                  setEditingId(null);
                  load();
                }}
                className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded"
                autoFocus
              />
            ) : (
              <span onClick={() => { setEditingId(d.id); setEditValue(d.name); }} className="cursor-pointer">
                {d.name}
              </span>
            )}
            <button onClick={() => deleteDriver(d.id)} className="text-red-500 hover:text-red-400 transition">🗑</button>
          </div>
        ))}
      </div>
      </>
      )}

      {tab === "teams" && (
      <>
      <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">🏁 Týmy</h2>
          <span className="text-xs text-zinc-500">{teams.length} položek</span>
        </div>

        <div className="flex gap-2 mb-4">
          <input
            value={newTeam}
            onChange={(e) => setNewTeam(e.target.value)}
            placeholder="Nový tým"
            className="flex-1 px-3 py-2 bg-zinc-900/70 border border-zinc-700/70 text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-white/40"
          />
          <button onClick={addTeam} className="px-3 py-1 rounded-lg bg-green-600/90 hover:bg-green-500/90 border border-green-500/30 transition active:scale-95">➕</button>
        </div>

        {teams.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between bg-zinc-900/60 p-3 rounded-lg mb-2 border border-zinc-800 hover:bg-zinc-800/40 transition"
          >
            {editingId === t.id ? (
              <input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={async () => {
                  await supabase.from("teams").update({ name: editValue }).eq("id", t.id);
                  setEditingId(null);
                  load();
                }}
                className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded"
                autoFocus
              />
            ) : (
              <span onClick={() => { setEditingId(t.id); setEditValue(t.name); }} className="cursor-pointer">
                {t.name}
              </span>
            )}
            <button onClick={() => deleteTeam(t.id)} className="text-red-500 hover:text-red-400 transition">🗑</button>
          </div>
        ))}
      </div>
      </>
      )}
    </div>
  );
}