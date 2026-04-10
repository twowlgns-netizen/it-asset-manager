// ✅ Claude 스타일 UI 유지 + 기능 확장 버전 (CSV/휴지통/로그)
import { useState, useEffect } from "react";

// ================= CSV EXPORT =================
const exportCSV = (data, filename = "assets.csv") => {
  if (!data || data.length === 0) return alert("내보낼 데이터가 없습니다.");

  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(","),
    ...data.map(row => headers.map(h => `"${(row[h] ?? "").toString().replace(/"/g, '""')}"`).join(","))
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
};

// ================= CSV IMPORT =================
const importCSV = (file, cb) => {
  if (!file) return;
  const reader = new FileReader();

  reader.onload = e => {
    try {
      const text = e.target.result;
      const [header, ...rows] = text.split("\n");
      const keys = header.split(",").map(h => h.replace(/"/g, "").trim());

      const data = rows
        .filter(r => r.trim())
        .map(r => {
          const values = r.split(",");
          const obj = {};

          keys.forEach((k, i) => {
            obj[k] = values[i]?.replace(/"/g, "") ?? "";
          });

          obj.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          obj.createdAt = new Date().toISOString();
          return obj;
        });

      cb(data);
    } catch (e) {
      alert("CSV 파일 형식 오류");
    }
  };

  reader.readAsText(file, "utf-8");
};

// ================= STORAGE =================
const safeStorage = {
  async get(key) {
    try {
      if (window.storage) return await window.storage.get(key);
      return { value: localStorage.getItem(key) };
    } catch {
      return { value: localStorage.getItem(key) };
    }
  },
  async set(key, value) {
    try {
      if (window.storage) return await window.storage.set(key, value);
      localStorage.setItem(key, value);
    } catch {
      localStorage.setItem(key, value);
    }
  }
};

// ================= UI 스타일 (Claude 느낌 유지) =================
const cardStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 20,
  marginBottom: 20,
  background: "#fff",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
};

const btnStyle = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  background: "#2563eb",
  color: "white",
  cursor: "pointer"
};

// ================= MAIN =================
export default function App() {
  const [hardware, setHardware] = useState([]);
  const [trash, setTrash] = useState([]);
  const [logs, setLogs] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const [h, t, l] = await Promise.all([
        safeStorage.get("itam-hw"),
        safeStorage.get("itam-trash"),
        safeStorage.get("itam-logs")
      ]);

      setHardware(h?.value ? JSON.parse(h.value) : []);
      setTrash(t?.value ? JSON.parse(t.value) : []);
      setLogs(l?.value ? JSON.parse(l.value) : []);

      setReady(true);
    })();
  }, []);

  useEffect(() => { if (ready) safeStorage.set("itam-hw", JSON.stringify(hardware)); }, [hardware, ready]);
  useEffect(() => { if (ready) safeStorage.set("itam-trash", JSON.stringify(trash)); }, [trash, ready]);
  useEffect(() => { if (ready) safeStorage.set("itam-logs", JSON.stringify(logs)); }, [logs, ready]);

  const addLog = (msg) => {
    setLogs(prev => [{ id: Date.now(), msg, time: new Date().toLocaleString() }, ...prev]);
  };

  const deleteAsset = (item) => {
    setHardware(prev => prev.filter(a => a.id !== item.id));
    setTrash(prev => [item, ...prev]);
    addLog(`삭제: ${item.name || item.id}`);
  };

  const restoreAsset = (item) => {
    setTrash(prev => prev.filter(a => a.id !== item.id));
    setHardware(prev => [item, ...prev]);
    addLog(`복구: ${item.name || item.id}`);
  };

  if (!ready) return <div style={{ padding: 40 }}>로딩중...</div>;

  return (
    <div style={{ padding: 30, background: "#f9fafb", minHeight: "100vh" }}>
      <h1 style={{ marginBottom: 20 }}>IT 자산관리 시스템</h1>

      {/* 상단 액션 */}
      <div style={{ ...cardStyle, display: "flex", gap: 10, alignItems: "center" }}>
        <button style={btnStyle} onClick={() => exportCSV(hardware, "hardware.csv")}>CSV 다운로드</button>

        <input
          type="file"
          accept=".csv"
          onChange={e => importCSV(e.target.files[0], data => {
            setHardware(prev => [...prev, ...data]);
            addLog(`CSV 업로드 (${data.length}건)`);
          })}
        />
      </div>

      {/* 자산 목록 */}
      <div style={cardStyle}>
        <h3>자산 목록 ({hardware.length})</h3>
        <table style={{ width: "100%" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th>이름</th>
              <th>동작</th>
            </tr>
          </thead>
          <tbody>
            {hardware.map(a => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>
                  <button style={btnStyle} onClick={() => deleteAsset(a)}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 휴지통 */}
      <div style={cardStyle}>
        <h3>휴지통</h3>
        <table style={{ width: "100%" }}>
          <tbody>
            {trash.map(a => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>
                  <button style={btnStyle} onClick={() => restoreAsset(a)}>복구</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 로그 */}
      <div style={cardStyle}>
        <h3>작업 로그</h3>
        <ul>
          {logs.map(l => (
            <li key={l.id}>{l.time} - {l.msg}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
