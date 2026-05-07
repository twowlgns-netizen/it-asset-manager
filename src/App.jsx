// ================================================================
// 📁 App.jsx - IT 자산관리 시스템의 메인 파일
// 이 파일 하나에 모든 화면(로그인, 대시보드, 장비관리 등)이 들어있습니다.
// ================================================================

import { useState, useEffect, useCallback } from "react";
// useState   : 화면에 표시되는 데이터를 저장하고 변경할 때 사용 (변경 시 화면 자동 갱신)
// useEffect  : 컴포넌트가 처음 열리거나, 특정 값이 바뀔 때 자동으로 실행할 코드를 등록
// useCallback: 함수를 "메모리에 기억"해서 불필요한 재생성을 막아 성능을 개선



// ================================================================
// ⚙️ [유틸리티] 자주 쓰는 도구 함수 모음
// ================================================================

// 현재 시각을 국제 표준 형식(ISO 8601)으로 반환하는 함수
// 예시 출력: "2025-01-15T09:30:00.000Z"
// 히스토리 기록 등에서 타임스탬프로 사용됩니다.
const nowISO = () => new Date().toISOString();

// 날짜 문자열을 한국어 "1월 15일 09:30" 형식으로 변환하는 함수
// d: 변환할 날짜 문자열 (없으면 "-" 반환)
const fDateTime = (d) =>
  d
    ? new Date(d).toLocaleString("ko-KR", {
        month: "short",   // 월 (예: "1월")
        day: "numeric",   // 일 (예: "15")
        hour: "2-digit",  // 시 (예: "09")
        minute: "2-digit",// 분 (예: "30")
      })
    : "-"; // 날짜가 없으면 "-" 표시

// 하드웨어 유형 코드 → 한국어 이름 매핑 테이블
// 👉 장비 종류를 추가하려면 여기에 줄을 추가하세요.
// 예시: notebook: "태블릿" 추가 가능
const HW_TYPES = {
  desktop: "데스크탑",
  monitor: "모니터",
  laptop: "노트북",
};

// 하드웨어 상태 코드 → 한국어 이름 매핑 테이블
// 👉 상태를 추가하려면 여기에 줄을 추가하세요.
// 예시: lost: "분실" 추가 가능
const HW_STATUS = {
  active: "사용중",
  inactive: "미사용",
  repair: "수리중",
  disposed: "폐기",
};

// 백엔드 서버 주소
// 👉 서버 주소가 바뀌면 이 줄만 수정하면 됩니다.
const BASE_URL = "https://samjee.duckdns.org";

// 초기 사용자 목록 (서버에서 사용자 정보를 못 불러올 때 사용하는 기본값)
// 👉 테스트용 계정입니다. 운영 환경에서는 서버에서 관리하세요.
const INIT_USERS = [
  { loginId: "admin", password: "admin123", name: "관리자", dept: "IT본부", role: "admin" },
  { loginId: "user",  password: "user123",  name: "이영희", dept: "디자인팀", role: "user"  },
];



// ================================================================
// 🌐 [API 헬퍼] 서버와 통신하는 함수 모음
// ================================================================

// 서버 응답을 안전하게 JSON으로 파싱하는 함수
// - 응답이 비어있거나 JSON이 아닌 경우에도 에러 없이 빈 객체 {} 반환
// - HTTP 에러(404, 500 등)는 예외(throw)를 발생시켜 호출부에서 처리
const safeJson = async (res) => {
  // 응답 상태가 오류(400, 500 등)인 경우 에러 발생
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  // 응답 본문을 텍스트로 읽기
  const text = await res.text();
  // 본문이 비어있으면 빈 객체 반환
  if (!text || text.trim() === "") return {};
  try {
    return JSON.parse(text); // 텍스트를 JSON 객체로 변환
  } catch {
    return {}; // JSON 파싱 실패 시 빈 객체 반환
  }
};

// 서버 API 호출 함수 모음 (REST API 형식)
// 👉 BASE_URL의 엔드포인트(경로)를 변경하려면 각 함수의 경로를 수정하세요.
const api = {

  // --- 하드웨어(자산) 관련 ---
  // 전체 자산 목록 가져오기 (GET /assets)
  getHardware: () =>
    fetch(`${BASE_URL}/assets`).then(safeJson),

  // 새 자산 추가 (POST /assets)
  // data: 추가할 자산 객체 { name, type, status, ... }
  addHardware: (data) =>
    fetch(`${BASE_URL}/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data), // 객체를 JSON 문자열로 변환해서 전송
    }).then(safeJson),

  // 특정 자산 수정 (PUT /assets/:id)
  // id: 수정할 자산의 고유 번호, data: 수정할 내용
  updateHardware: (id, data) =>
    fetch(`${BASE_URL}/assets/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(safeJson),

  // 특정 자산 삭제 (DELETE /assets/:id)
  deleteHardware: (id) =>
    fetch(`${BASE_URL}/assets/${id}`, { method: "DELETE" }).then(safeJson),


  // --- 사용자 관련 ---
  // 전체 사용자 목록 가져오기 (GET /users)
  getUsers: () =>
    fetch(`${BASE_URL}/users`).then(safeJson),


  // --- 히스토리(활동 로그) 관련 ---
  // 전체 로그 가져오기 (GET /history)
  getHistory: () =>
    fetch(`${BASE_URL}/history`).then(safeJson),

  // 새 로그 기록 추가 (POST /history)
  addHistory: (data) =>
    fetch(`${BASE_URL}/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(safeJson),


  // --- 휴지통 관련 ---
  // 휴지통 목록 가져오기 (GET /trash)
  getTrash: () =>
    fetch(`${BASE_URL}/trash`).then(safeJson),

  // 휴지통에 아이템 추가 (POST /trash)
  addTrash: (data) =>
    fetch(`${BASE_URL}/trash`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(safeJson),

  // 휴지통에서 특정 아이템 삭제 (DELETE /trash/:id)
  deleteTrash: (id) =>
    fetch(`${BASE_URL}/trash/${id}`, { method: "DELETE" }).then(safeJson),

  // 아이템 복구: 휴지통에서 삭제 후 원래 테이블에 되살리기
  // type: "assets" 등 원래 데이터 종류, id: 아이템 ID, data: 복구할 데이터
  restoreItem: (type, id, data) =>
    fetch(`${BASE_URL}/${type}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(safeJson),
};



// ================================================================
// 🏠 [메인 앱] 전체 앱의 뼈대 컴포넌트
// 로그인 여부 확인, 메뉴 전환, 데이터 로딩 등을 담당합니다.
// ================================================================
export default function App() {

  // ---- 로그인 상태 관리 ----
  // localStorage: 브라우저를 닫았다 열어도 유지되는 저장소
  // 초기값으로 이전에 저장된 로그인 상태를 불러옴
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem("isLoggedIn") === "true";
  });

  // 현재 로그인한 사용자 정보 (name, dept, role 등)
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem("currentUser");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // ---- 화면 전환 상태 ----
  // "dashboard" | "hardware" | "history" | "trash" 중 현재 보여줄 화면
  const [view, setView] = useState("dashboard");

  // ---- 반응형 레이아웃 ----
  // 화면 너비가 768px 미만이면 모바일 레이아웃 사용
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  // ---- 데이터 상태 ----
  const [hardware, setHardware] = useState([]); // 하드웨어 자산 목록
  const [users, setUsers]       = useState(INIT_USERS); // 사용자 목록
  const [history, setHistory]   = useState([]); // 활동 로그 목록
  const [trash, setTrash]       = useState([]); // 휴지통 목록


  // ---- 로그인 처리 함수 ----
  // 로그인 성공 시 호출: 상태를 저장하고 브라우저 localStorage에도 기록
  const handleLogin = (user) => {
    setIsLoggedIn(true);
    setCurrentUser(user);
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("currentUser", JSON.stringify(user)); // 객체를 문자열로 변환해 저장
  };

  // ---- 로그아웃 처리 함수 ----
  // 상태 초기화 + localStorage 삭제
  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("currentUser");
  };


  // ---- 전체 데이터 새로고침 함수 ----
  // useCallback: 이 함수는 의존하는 값이 없으므로 앱이 살아있는 동안 동일한 함수 재사용
  const fetchAll = useCallback(() => {
    // 하드웨어 목록 불러오기
    api.getHardware()
      .then((data) => setHardware(Array.isArray(data) ? data : []))
      .catch((err) => console.error("hardware fetch error:", err));

    // 사용자 목록 불러오기 (서버 데이터가 없으면 INIT_USERS 사용)
    api.getUsers()
      .then((data) => setUsers(Array.isArray(data) && data.length > 0 ? data : INIT_USERS))
      .catch((err) => console.error("users fetch error:", err));

    // 활동 로그 불러오기 (최신순 정렬)
    api.getHistory()
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        // ts(타임스탬프) 기준 내림차순 정렬: 최신 로그가 맨 위
        setHistory(list.sort((a, b) => new Date(b.ts) - new Date(a.ts)));
      })
      .catch((err) => console.error("history fetch error:", err));

    // 휴지통 목록 불러오기
    api.getTrash()
      .then((data) => setTrash(Array.isArray(data) ? data : []))
      .catch((err) => console.error("trash fetch error:", err));
  }, []);


  // ---- 앱 시작 시 실행 ----
  // useEffect의 두 번째 인자 [fetchAll]: fetchAll이 바뀔 때만 다시 실행 (사실상 최초 1회)
  useEffect(() => {
    // 화면 크기 변화 감지 → 모바일/PC 전환
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);

    // 서버에서 전체 데이터 불러오기
    fetchAll();

    // 컴포넌트가 사라질 때 이벤트 리스너 제거 (메모리 누수 방지)
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [fetchAll]);


  // ---- 활동 로그 기록 함수 ----
  // action  : 수행한 작업 이름 (예: "하드웨어 등록")
  // aType   : 대상 종류 (예: "hardware")
  // aId     : 대상 ID
  // aName   : 대상 이름 (예: "MacBook Pro")
  // detail  : 추가 설명 (예: "신규 등록")
  const addHistory = useCallback(
    (action, aType, aId, aName, detail) => {
      if (!currentUser) return; // 로그인 안 된 상태면 기록 안 함
      api
        .addHistory({
          ts: nowISO(),              // 현재 시각
          action,
          aType,
          aId,
          aName,
          detail,
          userName: currentUser.name, // 로그인한 사용자 이름
        })
        .then(() => {
          // 기록 후 히스토리 목록 새로고침
          api.getHistory().then((data) => {
            const list = Array.isArray(data) ? data : [];
            setHistory(list.sort((a, b) => new Date(b.ts) - new Date(a.ts)));
          });
        })
        .catch((err) => console.error("addHistory error:", err));
    },
    [currentUser] // currentUser가 바뀔 때만 함수 재생성
  );


  // ---- 로그인 안 된 경우 로그인 화면 표시 ----
  if (!isLoggedIn) return <LoginPage onLogin={handleLogin} users={users} />;

  // 편집 권한 확인: admin 또는 user 역할이면 수정/삭제 가능
  // 👉 역할별 권한을 바꾸려면 이 줄을 수정하세요.
  const canEdit = currentUser?.role === "admin" || currentUser?.role === "user";

  // ---- 메뉴 목록 ----
  // 👉 메뉴를 추가하려면 여기에 항목을 추가하고, 아래 view 분기도 추가하세요.
  const menuItems = [
    { id: "dashboard", label: "홈",    icon: "🏠" },
    { id: "hardware",  label: "장비",  icon: "🖥️" },
    { id: "history",   label: "로그",  icon: "📝" },
    { id: "trash",     label: "휴지통", icon: "🗑️" },
  ];


  // ---- 화면 렌더링 ----
  return (
    <div
      style={{
        display: "flex",
        // 모바일: 위아래(column), PC: 옆으로(row) 배치
        flexDirection: isMobile ? "column" : "row",
        height: "100vh",       // 화면 전체 높이 사용
        background: "#f8fafc", // 전체 배경색 (연한 회색)
        // 👉 배경색을 바꾸려면 "#f8fafc"를 원하는 색상 코드로 변경하세요.
        overflow: "hidden",
      }}
    >

      {/* ── PC 전용 좌측 사이드바 ── */}
      {!isMobile && (
        <div
          style={{
            width: 250,                        // 사이드바 너비 (px)
            // 👉 사이드바 너비를 바꾸려면 250을 다른 값으로 변경하세요.
            background: "#fff",
            borderRight: "1px solid #e2e8f0", // 오른쪽 구분선
            padding: "24px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* 앱 이름 (로고 영역) */}
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0f6e56", marginBottom: 40 }}>
            Asset Manager
            {/* 👉 앱 이름을 바꾸려면 "Asset Manager"를 수정하세요. */}
          </div>

          {/* 메뉴 버튼 목록 */}
          <div style={{ flex: 1 }}>
            {menuItems.map((m) => (
              <div
                key={m.id}
                onClick={() => setView(m.id)} // 클릭 시 해당 화면으로 전환
                style={{
                  padding: "12px 16px",
                  borderRadius: 12,
                  cursor: "pointer",
                  // 현재 선택된 메뉴는 배경색과 글자색 변경
                  background: view === m.id ? "#e8f5e9" : "transparent",
                  color:      view === m.id ? "#0f6e56" : "#64748b",
                  // 👉 선택된 메뉴 색상을 바꾸려면 "#e8f5e9"와 "#0f6e56"을 수정하세요.
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                {m.icon} {m.label}
              </div>
            ))}
          </div>

          {/* 로그아웃 버튼 */}
          <Btn onClick={handleLogout}>로그아웃</Btn>
        </div>
      )}


      {/* ── 메인 콘텐츠 영역 ── */}
      <div style={{ flex: 1, overflowY: "auto" }}>

        {/* 모바일 전용 상단 헤더 */}
        {isMobile && (
          <div
            style={{
              background: "#fff",
              padding: "16px 20px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              position: "sticky", // 스크롤해도 상단에 고정
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

        {/* 각 화면 컴포넌트 전환 영역 */}
        <main style={{ padding: isMobile ? "20px" : "40px", paddingBottom: 100 }}>

          {/* 대시보드 화면 */}
          {view === "dashboard" && (
            <DashboardSection
              stats={{ hw: hardware, users }}
              history={history}
              isMobile={isMobile}
            />
          )}

          {/* 하드웨어 관리 화면 */}
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

          {/* 활동 로그 화면 */}
          {view === "history" && <HistorySection history={history} />}

          {/* 휴지통 화면 */}
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


      {/* ── 모바일 전용 하단 탭 메뉴 ── */}
      {isMobile && (
        <div
          style={{
            position: "fixed", // 화면 아래에 고정
            bottom: 0,
            left: 0,
            right: 0,
            height: 70,        // 탭바 높이
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
              style={{
                textAlign: "center",
                // 선택된 탭은 초록색, 나머지는 회색
                color: view === m.id ? "#0f6e56" : "#94a3b8",
              }}
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



// ================================================================
// 📊 [대시보드] 홈 화면 - 전체 현황 요약 카드
// props:
//   stats   - { hw: 하드웨어 배열, users: 사용자 배열 }
//   history - 활동 로그 배열
//   isMobile - 모바일 여부
// ================================================================
function DashboardSection({ stats, history, isMobile }) {
  return (
    <div>
      <h2 style={{ fontSize: 24, marginBottom: 24, fontWeight: 700 }}>실시간 현황 요약</h2>

      {/* 현황 카드 그리드 */}
      <div
        style={{
          display: "grid",
          // 모바일: 2열, PC: 3열
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)",
          // 👉 PC에서 카드 개수를 바꾸려면 "repeat(3, 1fr)"의 3을 변경하세요.
          gap: 16,
        }}
      >
        {/* 전체 장비 수 카드 */}
        <div
          style={{
            background: "#fff",
            padding: "20px",
            borderRadius: 20,
            border: "1px solid #e2e8f0",
          }}
        >
          <div style={{ fontSize: 12, color: "#64748b" }}>전체 장비</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#0f6e56" }}>
            {stats.hw.length} {/* 하드웨어 배열의 길이 = 전체 장비 수 */}
          </div>
        </div>

        {/* 최근 로그 수 카드 */}
        <div
          style={{
            background: "#fff",
            padding: "20px",
            borderRadius: 20,
            border: "1px solid #e2e8f0",
          }}
        >
          <div style={{ fontSize: 12, color: "#64748b" }}>최근 로그</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#2563eb" }}>
            {history.length} {/* 로그 배열의 길이 = 전체 로그 수 */}
          </div>
        </div>

        {/* 👉 카드를 추가하려면 위와 같은 div 블록을 복사해서 여기에 붙이세요. */}
        {/* 예시: 사용자 수 카드 */}
        {/* <div style={{ background: "#fff", padding: "20px", borderRadius: 20, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>전체 사용자</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#9333ea" }}>{stats.users.length}</div>
        </div> */}
      </div>
    </div>
  );
}



// ================================================================
// 🖥️ [하드웨어] 자산 목록 및 등록/수정/삭제 화면
// props:
//   data       - 하드웨어 배열
//   setHardware - 하드웨어 상태 변경 함수
//   addHistory  - 로그 기록 함수
//   canEdit     - 수정 권한 여부
//   trash, setTrash - 휴지통 상태 및 변경 함수
// ================================================================
function HardwareSection({ data, setHardware, addHistory, canEdit, trash, setTrash }) {

  // modal: 현재 열려있는 모달 종류 (null=닫힘, "add"=등록, "edit"=수정)
  const [modal, setModal] = useState(null);

  // form: 모달 안의 입력 값 (자산명, 유형, 상태 등)
  const [form, setForm] = useState({});

  // loading: 저장 중 여부 (true이면 버튼 비활성화)
  const [loading, setLoading] = useState(false);


  // ---- 자산 저장(등록 또는 수정) 함수 ----
  const save = () => {
    // 자산명 미입력 시 경고
    if (!form.name) return alert("자산명을 입력하세요.");
    setLoading(true);

    const isAdd = modal === "add"; // 등록 모드인지 수정 모드인지 구분

    // 등록 시에는 생성 시각(createdAt)을 추가해서 전송
    const newItem = isAdd ? { ...form, createdAt: nowISO() } : form;
    const request = isAdd
      ? api.addHardware(newItem)           // 신규 등록 API 호출
      : api.updateHardware(form.id, form); // 수정 API 호출

    request
      .then(() => {
        // 저장 성공 후 서버에서 최신 목록 다시 불러오기
        return api.getHardware();
      })
      .then((list) => {
        const fresh = Array.isArray(list) ? list : [];
        setHardware(fresh); // 화면의 하드웨어 목록 갱신

        if (isAdd) {
          // 새로 추가된 항목을 이름으로 찾아 히스토리에 기록
          const created = fresh.find((h) => h.name === form.name);
          addHistory("하드웨어 등록", "hardware", created?.id ?? "", form.name, "신규 등록");
        } else {
          addHistory("하드웨어 수정", "hardware", form.id, form.name, "정보 수정");
        }
        setModal(null); // 모달 닫기
      })
      .catch((err) => {
        console.error("save error:", err);
        alert(`오류가 발생했습니다.\n${err.message}`);
      })
      .finally(() => setLoading(false)); // 성공/실패 상관없이 로딩 종료
  };


  // ---- 자산 삭제(휴지통 이동) 함수 ----
  const deleteItem = (item) => {
    // 삭제 전 확인 팝업
    if (!window.confirm(`"${item.name}"을(를) 휴지통으로 이동하시겠습니까?`)) return;

    // 휴지통 항목에는 원본 데이터 + 종류(type) + 삭제 시각을 추가
    const trashItem = { ...item, type: "assets", deletedAt: nowISO() };

    api
      .deleteHardware(item.id)          // 서버에서 자산 삭제
      .then(() => api.addTrash(trashItem)) // 휴지통에 추가
      .then((addedTrash) => {
        // 화면에서도 해당 항목 제거
        setHardware((prev) => prev.filter((h) => h.id !== item.id));
        setTrash((prev) => [...prev, addedTrash]); // 휴지통 목록에 추가
        addHistory("하드웨어 삭제", "hardware", item.id, item.name, "휴지통 이동");
      })
      .catch((err) => {
        console.error(err);
        alert("삭제 중 오류가 발생했습니다.");
      });
  };


  return (
    <div>
      {/* 상단: 제목 + 등록 버튼 */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>하드웨어</h2>
        {canEdit && (
          <Btn
            onClick={() => {
              // 등록 모달 열기: 기본값 설정
              setForm({ status: "active", type: "laptop" });
              // 👉 등록 시 기본 상태/유형을 바꾸려면 여기를 수정하세요.
              setModal("add");
            }}
            variant="primary"
          >
            + 등록
          </Btn>
        )}
      </div>

      {/* 자산 목록 테이블 */}
      <ResponsiveTable
        cols={[
          { label: "자산명", render: (h) => <b>{h.name}</b> },
          { label: "유형",   render: (h) => HW_TYPES[h.type]   || h.type   },
          { label: "상태",   render: (h) => HW_STATUS[h.status] || h.status },
          {
            label: "관리",
            render: (h) =>
              canEdit && (
                <div style={{ display: "flex", gap: 8 }}>
                  {/* 수정 버튼: 해당 항목 데이터를 form에 채우고 edit 모달 열기 */}
                  <Btn
                    onClick={() => {
                      setForm(h);
                      setModal("edit");
                    }}
                  >
                    수정
                  </Btn>
                  {/* 삭제 버튼 */}
                  <Btn onClick={() => deleteItem(h)} variant="danger">
                    삭제
                  </Btn>
                </div>
              ),
          },
        ]}
        rows={data}
      />

      {/* 등록/수정 모달 (modal 값이 있을 때만 표시) */}
      {modal && (
        <Modal
          title={modal === "add" ? "새 자산 등록" : "자산 정보 수정"}
          onClose={() => setModal(null)} // X 버튼 누르면 모달 닫기
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* 자산명 입력 */}
            <input
              placeholder="자산명"
              value={form.name || ""}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              // 👉 placeholder 텍스트를 바꾸려면 위 "자산명"을 수정하세요.
              style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
            />

            {/* 유형 선택 드롭다운 (HW_TYPES에서 자동 생성) */}
            <select
              value={form.type || "laptop"}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
            >
              {Object.entries(HW_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
              {/* 👉 유형을 추가하려면 맨 위의 HW_TYPES 객체에 항목을 추가하세요. */}
            </select>

            {/* 상태 선택 드롭다운 (HW_STATUS에서 자동 생성) */}
            <select
              value={form.status || "active"}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
            >
              {Object.entries(HW_STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
              {/* 👉 상태를 추가하려면 맨 위의 HW_STATUS 객체에 항목을 추가하세요. */}
            </select>

            {/* 저장 버튼 (저장 중이면 비활성화) */}
            <Btn onClick={save} variant="primary" disabled={loading}>
              {loading ? "저장 중..." : "저장"}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}



// ================================================================
// 📝 [히스토리] 활동 로그 목록 화면
// props:
//   history - 로그 배열 (ts, userName, action, aName 필드 포함)
// ================================================================
function HistorySection({ history }) {
  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>활동 로그</h2>
      <ResponsiveTable
        cols={[
          {
            label: "시간",
            // ts(타임스탬프)를 읽기 좋은 한국어 형식으로 변환
            render: (h) => <span style={{ fontSize: 11 }}>{fDateTime(h.ts)}</span>,
          },
          { label: "수행자", key: "userName" }, // 로그 기록한 사용자 이름
          { label: "액션",   key: "action"   }, // 수행한 작업 (예: "하드웨어 등록")
          { label: "대상",   key: "aName"    }, // 작업 대상 이름 (예: "MacBook Pro")
        ]}
        rows={history}
      />
    </div>
  );
}



// ================================================================
// 🗑️ [휴지통] 삭제된 항목 목록 및 복구 화면
// props:
//   trash, setTrash   - 휴지통 상태 및 변경 함수
//   setHardware       - 하드웨어 상태 변경 함수 (복구 시 목록 업데이트)
//   addHistory        - 로그 기록 함수
//   canEdit           - 복구 권한 여부
// ================================================================
function TrashSection({ trash, setTrash, setHardware, addHistory, canEdit }) {

  // ---- 항목 복구 함수 ----
  const restore = (item) => {
    // 복구 시에는 휴지통 전용 필드(type, deletedAt)를 제거하고 원본 데이터만 사용
    const { type, deletedAt, ...rest } = item;

    api
      .deleteTrash(item.id)              // 휴지통에서 삭제
      .then(() => api.restoreItem(type, item.id, rest)) // 원래 테이블에 복구
      .then((restored) => {
        // 휴지통 목록에서 제거
        setTrash((prev) => prev.filter((t) => t.id !== item.id));

        // 자산(assets) 복구인 경우 하드웨어 목록에 추가
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
          { label: "이름",   key: "name" },
          { label: "삭제일", render: (i) => fDateTime(i.deletedAt) }, // 삭제된 시각
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



// ================================================================
// 🔑 [로그인] 로그인 화면
// props:
//   onLogin - 로그인 성공 시 호출할 함수
//   users   - 사용자 목록 (아이디/비밀번호 검증에 사용)
// ================================================================
function LoginPage({ onLogin, users }) {
  const [id, setId] = useState(""); // 아이디 입력값
  const [pw, setPw] = useState(""); // 비밀번호 입력값

  // 로그인 폼 제출 처리
  const submit = (e) => {
    e.preventDefault(); // 기본 폼 제출(페이지 새로고침) 방지

    // 입력한 아이디·비밀번호와 일치하는 사용자 찾기
    const user = users.find((u) => u.loginId === id && u.password === pw);
    if (user) onLogin(user);           // 찾으면 로그인 처리
    else alert("아이디 또는 비밀번호가 틀립니다."); // 없으면 경고
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f1f5f9", // 로그인 페이지 배경색
        // 👉 배경색을 바꾸려면 "#f1f5f9"를 수정하세요.
      }}
    >
      <form
        onSubmit={submit}
        style={{ width: 340, background: "#fff", padding: 40, borderRadius: 24 }}
      >
        {/* 로고/제목 */}
        <h1 style={{ textAlign: "center", color: "#0f6e56", marginBottom: 30 }}>
          Asset Pro
          {/* 👉 로그인 화면 제목을 바꾸려면 "Asset Pro"를 수정하세요. */}
        </h1>

        {/* 아이디 입력 */}
        <input
          placeholder="아이디"
          value={id}
          onChange={(e) => setId(e.target.value)}
          required // HTML 기본 필수 입력 처리
          style={{
            width: "100%", padding: 15, marginBottom: 10,
            borderRadius: 10, border: "1px solid #eee",
            boxSizing: "border-box", // padding이 너비에 포함되도록
          }}
        />

        {/* 비밀번호 입력 */}
        <input
          type="password" // 입력 내용을 ***로 숨김
          placeholder="비밀번호"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          required
          style={{
            width: "100%", padding: 15, marginBottom: 20,
            borderRadius: 10, border: "1px solid #eee",
            boxSizing: "border-box",
          }}
        />

        {/* 로그인 버튼 */}
        <Btn type="submit" variant="primary" style={{ width: "100%", padding: 16 }}>
          로그인
        </Btn>
      </form>
    </div>
  );
}



// ================================================================
// 🔘 [공통 컴포넌트] Btn - 재사용 가능한 버튼
// props:
//   onClick  - 클릭 이벤트 함수
//   variant  - 버튼 스타일 종류: "default" | "primary" | "danger" | "warning"
//   children - 버튼 안에 표시할 내용 (텍스트 등)
//   style    - 추가 스타일 (선택)
//   disabled - 비활성화 여부 (기본값: false)
//   type     - 버튼 타입 (기본값: "button", 폼 제출에는 "submit")
// ================================================================
function Btn({ onClick, variant = "default", children, style = {}, disabled = false, type = "button" }) {

  // 버튼 스타일 종류별 색상 정의
  // 👉 버튼 색상을 바꾸려면 아래 각 variant의 값을 수정하세요.
  const styles = {
    default: { background: "#fff",    color: "#333",    border: "1px solid #ddd"    }, // 기본 (흰색)
    primary: { background: "#0f6e56", color: "#fff",    border: "none"              }, // 주요 동작 (초록)
    danger:  { background: "#fff1f0", color: "#cf1322", border: "1px solid #ffa39e" }, // 위험 동작 (빨간)
    warning: { background: "#fffbe6", color: "#d48806", border: "1px solid #ffe58f" }, // 주의 동작 (노란)
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
        cursor: disabled ? "not-allowed" : "pointer", // 비활성화 시 금지 커서
        opacity: disabled ? 0.6 : 1,                  // 비활성화 시 흐리게
        ...styles[variant], // 선택한 variant 스타일 적용
        ...style,           // 외부에서 전달된 추가 스타일 덮어쓰기
      }}
    >
      {children}
    </button>
  );
}



// ================================================================
// 🪟 [공통 컴포넌트] Modal - 팝업 모달 창
// props:
//   title    - 모달 상단에 표시할 제목
//   onClose  - X 버튼 클릭 시 호출할 함수
//   children - 모달 안에 표시할 내용
// ================================================================
function Modal({ title, onClose, children }) {
  return (
    // 어두운 반투명 배경 (오버레이)
    <div
      style={{
        position: "fixed",
        inset: 0, // top:0, right:0, bottom:0, left:0 동시 설정
        background: "rgba(0,0,0,0.5)", // 검정 50% 투명
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999, // 다른 모든 요소 위에 표시
      }}
    >
      {/* 모달 본체 */}
      <div
        style={{ background: "#fff", borderRadius: 24, width: "90%", maxWidth: 500, padding: 24 }}
      >
        {/* 제목 + 닫기(X) 버튼 */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button onClick={onClose}>✕</button>
        </div>

        {/* 모달 내용 (children으로 전달된 JSX) */}
        {children}
      </div>
    </div>
  );
}



// ================================================================
// 📋 [공통 컴포넌트] ResponsiveTable - 반응형 데이터 테이블
// props:
//   cols  - 컬럼 정의 배열
//           [{ label: "제목", key: "필드명" }]          → row["필드명"] 값 표시
//           [{ label: "제목", render: (row) => <JSX> }] → 커스텀 렌더링
//   rows  - 표시할 데이터 배열
//   empty - 데이터 없을 때 표시할 문구 (기본: "데이터가 없습니다.")
// ================================================================
function ResponsiveTable({ cols, rows, empty = "데이터가 없습니다." }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        border: "1px solid #eee",
        overflowX: "auto", // 컬럼이 많을 때 가로 스크롤 허용
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>

        {/* 테이블 헤더 */}
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

        {/* 테이블 바디 */}
        <tbody>
          {rows.length === 0 ? (
            // 데이터가 없을 때 안내 메시지
            <tr>
              <td colSpan={cols.length} style={{ padding: 40, textAlign: "center" }}>
                {empty}
              </td>
            </tr>
          ) : (
            // 데이터가 있을 때 각 행 렌더링
            rows.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: "1px solid #f9f9f9" }}>
                {cols.map((c, ci) => (
                  <td key={ci} style={{ padding: "16px 12px", fontSize: 13 }}>
                    {/* render 함수가 있으면 커스텀 렌더링, 없으면 key로 값 표시 */}
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
