import { useState, useEffect, useCallback } from "react";

// ===================== [유틸리티] =====================
const nowISO = () => new Date().toISOString();
const fDateTime = (d) =>
  d
    ? new Date(d).toLocaleString("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";
const HW_TYPES = { desktop: "데스크탑", monitor: "모니터", laptop: "노트북" };
const HW_STATUS = { active: "사용중", inactive: "미사용", repair: "수리중", disposed: "폐기" };

const BASE_URL = "https://samjee.duckdns.org";

const INIT_USERS = [
  { loginId: "admin", password: "admin123", name: "관리자", dept: "IT본부", role: "admin" },
  { loginId: "user", password: "user123", name: "이영희", dept: "디자인팀", role: "user" },
];

// ===================== [API 헬퍼] =====================
const api = {
  // 하드웨어
  getHardware: () =>
    fetch(`${BASE_URL}/assets`).then((r) => r.json()),
  addHardware: (data) =>
    fetch(`${BASE_URL}/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  updateHardware: (id, data) =>
    fetch(`${BASE_URL}/assets/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  deleteHardware: (id) =>
    fetch(`${BASE_URL}/assets/${id}`, { method: "DELETE" }).then((r) => r.json()),

  // 유저
  getUsers: () =>
    fetch(`${BASE_URL}/users`).then((r) => r.json()),

  // 히스토리
  getHistory: () =>
    fetch(`${BASE_URL}/history`).then((r) => r.json()),
  addHistory: (data) =>
    fetch(`${BASE_URL}/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  // 휴지통
  getTrash: () =>
    fetch(`${BASE_URL}/trash`).then((r) => r.json()),
  addTrash: (data) =>
    fetch(`${BASE_URL}/trash`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  deleteTrash: (id) =>
    fetch(`${BASE_URL}/trash/${id}`, { method: "DELETE" }).then((r) => r.json()),

  // 복구: trash 삭제 후 원래 경로에 PUT
  restoreItem: (type, id, data) =>
    fetch(`${BASE_URL}/${type}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
};

// ===================== [메인 앱] =====================
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem("isLoggedIn") === "true";
  });
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem("currentUser");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [view, setView] = useState("dashboard");
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  const [hardware, setHardware] = useState([]);
  const [users, setUsers] = useState(INIT_USERS);
  const [history, setHistory] = useState([]);
  const [trash, setTrash] = useState([]);

  // 로그인
  const handleLogin = (user) => {
    setIsLoggedIn(true);
    setCurrentUser(user);
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("currentUser", JSON.stringify(user));
  };

  // 로그아웃
  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("currentUser");
  };

  // 데이터 불러오기
  const fetchAll = useCallback(() => {
    api.getHardware()
      .then((data) => setHardware(Array.isArray(data) ? data : []))
      .catch((err) => console.error("hardware fetch error:", err));

    api.getUsers()
      .then((data) => setUsers(Array.isArray(data) && data.length > 0 ? data : INIT_USERS))
      .catch((err) => console.error("users fetch error:", err));

    api.getHistory()
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setHistory(list.sort((a, b) => new Date(b.ts) - new Date(a.ts)));
      })
      .catch((err) => console.error("history fetch error:", err));

    api.getTrash()
      .then((data) => setTrash(Array.isArray(data) ? data : []))
      .catch((err) => console.error("trash fetch error:", err));
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);

    fetchAll();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [fetchAll]);

  // 히스토리 추가
  const addHistory = useCallback(
    (action, aType, aId, aName, detail) => {
      if (!currentUser) return;
      api
        .addHistory({
          ts: nowISO(),
          action,
          aType,
          aId,
          aName,
          detail,
          userName: currentUser.name,
        })
        .then(() => {
          api.getHistory().then((data) => {
            const list = Array.isArray(data) ? data : [];
            setHistory(list.sort((a, b) => new Date(b.ts) - new Date(a.ts)));
          });
        })
        .catch((err) => console.error("addHistory error:", err));
    },
    [currentUser]
  );

  if (!isLoggedIn) return <LoginPage onLogin={handleLogin} users={users} />;

  const canEdit = currentUser?.role === "admin" || currentUser?.role === "user";

  const menuItems = [
    { id: "dashboard", label: "홈", icon: "🏠" },
    { id: "hardware", label: "장비", icon: "🖥️" },
    { id: "history", label: "로그", icon: "📝" },
    { id: "trash", label: "휴지통", icon: "🗑️" },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        height: "100vh",
        background: "#f8fafc",
        overflow: "hidden",
      }}
    >
      {!isMobile && (
        <div
          style={{
            width: 250,
            background: "#fff",
            borderRight: "1px solid #e2e8f0",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0f6e56", marginBottom: 40 }}>
            Asset Manager
          </div>
          <div style={{ flex: 1 }}>
            {menuItems.map((m) => (
              <div
                key={m.id}
                onClick={() => setView(m.id)}
                style={{
                  padding: "12px 16px",
                  borderRadius: 12,
                  cursor: "pointer",
                  background: view === m.id ? "#e8f5e9" : "transparent",
                  color: view === m.id ? "#0f6e56" : "#64748b",
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                {m.icon} {m.label}
              </div>
            ))}
          </div>
          <Btn onClick={handleLogout}>로그아웃</Btn>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto" }}>
        {isMobile && (
          <div
            style={{
              background: "#fff",
              padding: "16px 20px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              position: "sticky",
              top: 0,
              zIndex: 10,
            }}
          >
            <span style={{ fontWeight: 800, color: "#0f6e56", fontSize: 18 }}>Asset Manager</span>
            <Btn onClick={handleLogout} style={{ fontSize: 11, padding: "5px 10px" }}>
              로그아웃
            </Btn>
          </div>
        )}
        <main style={{ padding: isMobile ? "20px" : "40px", paddingBottom: 100 }}>
          {view === "dashboard" && (
            <DashboardSection
              stats={{ hw: hardware, users }}
              history={history}
              isMobile={isMobile}
            />
          )}
          {view === "hardware" && (
            <HardwareSection
              data={hardware}
              setHardware={setHardware}
              addHistory={addHistory}
              canEdit={canEdit}
              trash={trash}
              setTrash={setTrash}
            />
          )}
          {view === "history" && <HistorySection history={history} />}
          {view === "trash" && (
            <TrashSection
              trash={trash}
              setTrash={setTrash}
              setHardware={setHardware}
              addHistory={addHistory}
              canEdit={canEdit}
            />
          )}
        </main>
      </div>

      {isMobile && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            height: 70,
            background: "#fff",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-around",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          {menuItems.map((m) => (
            <div
              key={m.id}
              onClick={() => setView(m.id)}
              style={{ textAlign: "center", color: view === m.id ? "#0f6e56" : "#94a3b8" }}
            >
              <div style={{ fontSize: 20 }}>{m.icon}</div>
              <div style={{ fontSize: 10 }}>{m.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================== [대시보드] =====================
function DashboardSection({ stats, history, isMobile }) {
  return (
    <div>
      <h2 style={{ fontSize: 24, marginBottom: 24, fontWeight: 700 }}>실시간 현황 요약</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)",
          gap: 16,
        }}
      >
        <div
          style={{
            background: "#fff",
            padding: "20px",
            borderRadius: 20,
            border: "1px solid #e2e8f0",
          }}
        >
          <div style={{ fontSize: 12, color: "#64748b" }}>전체 장비</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#0f6e56" }}>{stats.hw.length}</div>
        </div>
        <div
          style={{
            background: "#fff",
            padding: "20px",
            borderRadius: 20,
            border: "1px solid #e2e8f0",
          }}
        >
          <div style={{ fontSize: 12, color: "#64748b" }}>최근 로그</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#2563eb" }}>{history.length}</div>
        </div>
      </div>
    </div>
  );
}

// ===================== [하드웨어] =====================
function HardwareSection({ data, setHardware, addHistory, canEdit, trash, setTrash }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);

  const save = () => {
    if (!form.name) return alert("자산명을 입력하세요.");
    setLoading(true);

    if (modal === "add") {
      const newItem = { ...form, createdAt: nowISO() };
      api
        .addHardware(newItem)
        .then((created) => {
          setHardware((prev) => [...prev, created]);
          addHistory("하드웨어 등록", "hardware", created.id, form.name, "신규 등록");
          setModal(null);
        })
        .catch((err) => {
          console.error(err);
          alert("저장 중 오류가 발생했습니다.");
        })
        .finally(() => setLoading(false));
    } else {
      api
        .updateHardware(form.id, form)
        .then((updated) => {
          setHardware((prev) => prev.map((h) => (h.id === form.id ? updated : h)));
          addHistory("하드웨어 수정", "hardware", form.id, form.name, "정보 수정");
          setModal(null);
        })
        .catch((err) => {
          console.error(err);
          alert("수정 중 오류가 발생했습니다.");
        })
        .finally(() => setLoading(false));
    }
  };

  const deleteItem = (item) => {
    if (!window.confirm(`"${item.name}"을(를) 휴지통으로 이동하시겠습니까?`)) return;
    const trashItem = { ...item, type: "assets", deletedAt: nowISO() };

    api
      .deleteHardware(item.id)
      .then(() => api.addTrash(trashItem))
      .then((addedTrash) => {
        setHardware((prev) => prev.filter((h) => h.id !== item.id));
        setTrash((prev) => [...prev, addedTrash]);
        addHistory("하드웨어 삭제", "hardware", item.id, item.name, "휴지통 이동");
      })
      .catch((err) => {
        console.error(err);
        alert("삭제 중 오류가 발생했습니다.");
      });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>하드웨어</h2>
        {canEdit && (
          <Btn
            onClick={() => {
              setForm({ status: "active", type: "laptop" });
              setModal("add");
            }}
            variant="primary"
          >
            + 등록
          </Btn>
        )}
      </div>
      <ResponsiveTable
        cols={[
          { label: "자산명", render: (h) => <b>{h.name}</b> },
          { label: "유형", render: (h) => HW_TYPES[h.type] || h.type },
          { label: "상태", render: (h) => HW_STATUS[h.status] || h.status },
          {
            label: "관리",
            render: (h) =>
              canEdit && (
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn
                    onClick={() => {
                      setForm(h);
                      setModal("edit");
                    }}
                  >
                    수정
                  </Btn>
                  <Btn onClick={() => deleteItem(h)} variant="danger">
                    삭제
                  </Btn>
                </div>
              ),
          },
        ]}
        rows={data}
      />
      {modal && (
        <Modal
          title={modal === "add" ? "새 자산 등록" : "자산 정보 수정"}
          onClose={() => setModal(null)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <input
              placeholder="자산명"
              value={form.name || ""}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
            />
            <select
              value={form.type || "laptop"}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
            >
              {Object.entries(HW_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <select
              value={form.status || "active"}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
            >
              {Object.entries(HW_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <Btn onClick={save} variant="primary" disabled={loading}>
              {loading ? "저장 중..." : "저장"}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ===================== [히스토리] =====================
function HistorySection({ history }) {
  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>활동 로그</h2>
      <ResponsiveTable
        cols={[
          {
            label: "시간",
            render: (h) => <span style={{ fontSize: 11 }}>{fDateTime(h.ts)}</span>,
          },
          { label: "수행자", key: "userName" },
          { label: "액션", key: "action" },
          { label: "대상", key: "aName" },
        ]}
        rows={history}
      />
    </div>
  );
}

// ===================== [휴지통] =====================
function TrashSection({ trash, setTrash, setHardware, addHistory, canEdit }) {
  const restore = (item) => {
    const { type, deletedAt, ...rest } = item;
    api
      .deleteTrash(item.id)
      .then(() => api.restoreItem(type, item.id, rest))
      .then((restored) => {
        setTrash((prev) => prev.filter((t) => t.id !== item.id));
        if (type === "assets") {
          setHardware((prev) => [...prev, restored]);
        }
        addHistory("데이터 복구", type, item.id, rest.name, "복구됨");
      })
      .catch((err) => {
        console.error(err);
        alert("복구 중 오류가 발생했습니다.");
      });
  };

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>휴지통</h2>
      <ResponsiveTable
        cols={[
          { label: "이름", key: "name" },
          { label: "삭제일", render: (i) => fDateTime(i.deletedAt) },
          {
            label: "관리",
            render: (i) =>
              canEdit && (
                <Btn onClick={() => restore(i)} variant="warning">
                  복구
                </Btn>
              ),
          },
        ]}
        rows={trash}
      />
    </div>
  );
}

// ===================== [로그인] =====================
function LoginPage({ onLogin, users }) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const submit = (e) => {
    e.preventDefault();
    const user = users.find((u) => u.loginId === id && u.password === pw);
    if (user) onLogin(user);
    else alert("아이디 또는 비밀번호가 틀립니다.");
  };
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f1f5f9",
      }}
    >
      <form
        onSubmit={submit}
        style={{ width: 340, background: "#fff", padding: 40, borderRadius: 24 }}
      >
        <h1 style={{ textAlign: "center", color: "#0f6e56", marginBottom: 30 }}>Asset Pro</h1>
        <input
          placeholder="아이디"
          value={id}
          onChange={(e) => setId(e.target.value)}
          required
          style={{
            width: "100%",
            padding: 15,
            marginBottom: 10,
            borderRadius: 10,
            border: "1px solid #eee",
            boxSizing: "border-box",
          }}
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          required
          style={{
            width: "100%",
            padding: 15,
            marginBottom: 20,
            borderRadius: 10,
            border: "1px solid #eee",
            boxSizing: "border-box",
          }}
        />
        <Btn type="submit" variant="primary" style={{ width: "100%", padding: 16 }}>
          로그인
        </Btn>
      </form>
    </div>
  );
}

// ===================== [공통 컴포넌트] =====================
function Btn({ onClick, variant = "default", children, style = {}, disabled = false, type = "button" }) {
  const styles = {
    default: { background: "#fff", color: "#333", border: "1px solid #ddd" },
    primary: { background: "#0f6e56", color: "#fff", border: "none" },
    danger: { background: "#fff1f0", color: "#cf1322", border: "1px solid #ffa39e" },
    warning: { background: "#fffbe6", color: "#d48806", border: "1px solid #ffe58f" },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 16px",
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        ...styles[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{ background: "#fff", borderRadius: 24, width: "90%", maxWidth: 500, padding: 24 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ResponsiveTable({ cols, rows, empty = "데이터가 없습니다." }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        border: "1px solid #eee",
        overflowX: "auto",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#fbfcfd" }}>
            {cols.map((c, i) => (
              <th
                key={i}
                style={{
                  padding: "16px 12px",
                  textAlign: "left",
                  fontSize: 12,
                  color: "#888",
                  borderBottom: "1px solid #f0f0f0",
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={cols.length} style={{ padding: 40, textAlign: "center" }}>
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: "1px solid #f9f9f9" }}>
                {cols.map((c, ci) => (
                  <td key={ci} style={{ padding: "16px 12px", fontSize: 13 }}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
