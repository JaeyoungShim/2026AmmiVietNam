/* =========================================================
   베트남 단기선교 일정표 — app.js
   순수 JS 해시 라우터 기반 SPA
   ========================================================= */
(function(){
  "use strict";

  var DATA = window.SCHEDULE_DATA;
  var DAYS = DATA.days;
  var PARTICIPANTS = DATA.participants;
  var STORAGE_KEY = "vn2026_selected_name";

  // 전체 이벤트를 날짜 순서대로 펼친 배열 (상세페이지 이전/다음 이동용)
  var FLAT = [];
  DAYS.forEach(function(day, dIdx){
    day.events.forEach(function(ev){
      FLAT.push({ dayIndex: dIdx, event: ev });
    });
  });
  var FLAT_INDEX_BY_ID = {};
  FLAT.forEach(function(item, i){ FLAT_INDEX_BY_ID[item.event.id] = i; });

  var root = document.getElementById("app");

  /* ---------------------------------------------------------
     유틸
  --------------------------------------------------------- */
  function getSelectedName(){
    try { return localStorage.getItem(STORAGE_KEY); } catch(e){ return null; }
  }
  function setSelectedName(name){
    try { localStorage.setItem(STORAGE_KEY, name); } catch(e){}
  }
  function clearSelectedName(){
    try { localStorage.removeItem(STORAGE_KEY); } catch(e){}
  }

  function timeToMinutes(t){
    if(!t) return null;
    var parts = t.split(":");
    return parseInt(parts[0],10)*60 + parseInt(parts[1],10);
  }
  function fmtRange(ev){
    if(ev.start && ev.end) return ev.start + " – " + ev.end;
    if(ev.end) return "~ " + ev.end;
    if(ev.start) return ev.start + " ~";
    return "";
  }

  var CATS = [
    { key:"transit",   icon:"✈️", test:/이동|출국|도착|공항|귀국/ },
    { key:"meal",      icon:"🍽️", test:/식사|점심|저녁|아침|조식|케이터링/ },
    { key:"worship",   icon:"🙏", test:/기도회|예배|리허설|개회식/ },
    { key:"program",   icon:"🎤", test:/집회|콘서트|레크레이션|멘토링|셋팅|사역/ },
    { key:"free",      icon:"🧭", test:/자유시간|힐링|구매|문화체험/ },
    { key:"logistics", icon:"🧳", test:/집합|기상|체크인|체크아웃|준비/ }
  ];
  function categorize(title){
    for(var i=0;i<CATS.length;i++){
      if(CATS[i].test.test(title)) return CATS[i];
    }
    return { key:"default", icon:"📌" };
  }

  function containsName(ev, name){
    if(!name) return false;
    return ev.content.indexOf(name) !== -1 || ev.title.indexOf(name) !== -1;
  }

  // 텍스트 노드를 순회하며 name 을 <mark class="hl"> 로 감싼다
  function highlightName(container, name){
    if(!name) return;
    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    var n;
    while((n = walker.nextNode())){
      if(n.nodeValue.indexOf(name) !== -1) nodes.push(n);
    }
    nodes.forEach(function(node){
      var frag = document.createDocumentFragment();
      var text = node.nodeValue;
      var idx = 0, pos;
      while((pos = text.indexOf(name, idx)) !== -1){
        if(pos > idx) frag.appendChild(document.createTextNode(text.slice(idx,pos)));
        var mark = document.createElement("mark");
        mark.className = "hl";
        mark.textContent = name;
        frag.appendChild(mark);
        idx = pos + name.length;
      }
      if(idx < text.length) frag.appendChild(document.createTextNode(text.slice(idx)));
      node.parentNode.replaceChild(frag, node);
    });
  }

  function weekdayLabel(w){ return "(" + w + ")"; }

  function wrapTablesForScroll(container){
    var tables = container.querySelectorAll("table");
    tables.forEach(function(table){
      var wrap = document.createElement("div");
      wrap.className = "table-scroll";
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
  }

  /* ---------------------------------------------------------
     라우터
  --------------------------------------------------------- */
  function parseHash(){
    var h = location.hash.replace(/^#\/?/, "");
    var parts = h.split("/").filter(Boolean);
    if(parts[0] === "day") return { view:"day", dayIndex: Math.max(0, Math.min(DAYS.length-1, parseInt(parts[1],10) || 0)) };
    if(parts[0] === "event") return { view:"event", eventId: parts[1] };
    if(parts[0] === "name") return { view:"name" };
    if(parts[0] === "checklist") return { view:"checklist" };
    return { view:"day", dayIndex: defaultDayIndex() };
  }

  function defaultDayIndex(){
    // 오늘 날짜가 여행 기간 내에 있으면 해당 날짜, 아니면 0번째 날
    var now = new Date();
    var year = DATA.year;
    for(var i=0;i<DAYS.length;i++){
      var d = DAYS[i];
      if(now.getFullYear()===year && (now.getMonth()+1)===d.month && now.getDate()===d.day) return i;
    }
    return 0;
  }

  function navigate(hash){ location.hash = hash; }

  window.addEventListener("hashchange", render);
  window.addEventListener("DOMContentLoaded", render);

  /* ---------------------------------------------------------
     렌더 — 진입점
  --------------------------------------------------------- */
  var lastDayIndex = 0;

  function render(){
    var name = getSelectedName();
    var route = parseHash();

    if(!name || route.view === "name"){
      renderNameScreen(name);
      return;
    }
    if(route.view === "event"){
      renderEventDetail(route.eventId, name);
      return;
    }
    if(route.view === "checklist"){
      renderChecklist(name);
      return;
    }
    lastDayIndex = route.dayIndex;
    renderDayView(route.dayIndex, name);
  }

  /* ---------------------------------------------------------
     1) 이름 선택 화면
  --------------------------------------------------------- */
  function renderNameScreen(currentName){
    var html = '' +
      '<div class="name-screen">' +
        '<div class="name-eyebrow">Ho Chi Minh · 2026.07.08 – 07.12</div>' +
        '<h1 class="name-title">베트남 단기선교<br>일정표</h1>' +
        '<p class="name-sub">' + (currentName ? "이름을 다시 선택해주세요." : "본인의 이름을 선택하면, 일정 곳곳에서 내 이름을 바로 확인할 수 있어요.") + '</p>' +
        '<div class="name-grid" id="nameGrid"></div>' +
        '<div class="name-foot">선택한 이름은 이 기기에 저장되며, 언제든 다시 바꿀 수 있어요.</div>' +
      '</div>';
    root.innerHTML = html;

    var grid = document.getElementById("nameGrid");
    PARTICIPANTS.forEach(function(nm){
      var btn = document.createElement("button");
      btn.className = "name-chip";
      btn.textContent = nm;
      if(nm === currentName){
        btn.style.borderColor = "var(--gold)";
        btn.style.background = "var(--gold-soft)";
      }
      btn.addEventListener("click", function(){
        setSelectedName(nm);
        navigate("#/day/" + defaultDayIndex());
      });
      grid.appendChild(btn);
    });
  }

  /* ---------------------------------------------------------
     2) 하루 일정표 (6:00 ~ 24:00 타임라인)
  --------------------------------------------------------- */
  var VIEW_START = 6*60;   // 06:00
  var VIEW_END   = 24*60;  // 24:00
  var HOUR_PX = 64;

  function renderDayView(dayIndex, name){
    var day = DAYS[dayIndex];

    var html = '' +
      '<div class="pass-header" id="passHeader">' +
        '<div class="pass-toprow">' +
          '<span>SAIGON MISSION · BOARDING PASS</span>' +
          '<div class="pass-toprow-actions">' +
            '<button class="pass-user" id="checklistBtn">📋 체크리스트</button>' +
            '<button class="pass-user" id="userBtn" title="이름 다시 선택">' + escapeHtml(name) + ' 님 <span aria-hidden="true">▾</span></button>' +
          '</div>' +
        '</div>' +
        '<div class="pass-daynav">' +
          '<button class="pass-arrow" id="prevDay" ' + (dayIndex===0 ? "disabled":"") + '>‹</button>' +
          '<div class="pass-daybody">' +
            '<div class="pass-dayemoji">' + day.emoji + '</div>' +
            '<div class="pass-daytitle">' + escapeHtml(day.title) + '</div>' +
            '<div class="pass-daymeta">7월 ' + day.day + '일 ' + weekdayLabel(day.weekday) + ' · DAY ' + (dayIndex+1) + ' / ' + DAYS.length + '</div>' +
          '</div>' +
          '<button class="pass-arrow" id="nextDay" ' + (dayIndex===DAYS.length-1 ? "disabled":"") + '>›</button>' +
        '</div>' +
        '<div class="pass-dots" id="dots"></div>' +
      '</div>' +
      '<div class="timeline-wrap" id="timelineWrap">' +
        '<div class="timeline" id="timeline"></div>' +
      '</div>';
    root.innerHTML = html;

    // 점(dot) 네비게이션
    var dots = document.getElementById("dots");
    DAYS.forEach(function(d, i){
      var dot = document.createElement("div");
      dot.className = "pass-dot" + (i===dayIndex ? " active" : "");
      dot.addEventListener("click", function(){ navigate("#/day/"+i); });
      dots.appendChild(dot);
    });

    document.getElementById("userBtn").addEventListener("click", function(){ navigate("#/name"); });
    document.getElementById("checklistBtn").addEventListener("click", function(){ navigate("#/checklist"); });
    var prevBtn = document.getElementById("prevDay");
    var nextBtn = document.getElementById("nextDay");
    if(prevBtn) prevBtn.addEventListener("click", function(){ if(dayIndex>0) navigate("#/day/"+(dayIndex-1)); });
    if(nextBtn) nextBtn.addEventListener("click", function(){ if(dayIndex<DAYS.length-1) navigate("#/day/"+(dayIndex+1)); });

    // 타임라인 구성: 06시 ~ 24시, 1시간 행
    var timeline = document.getElementById("timeline");
    var totalHours = (VIEW_END - VIEW_START) / 60; // 18
    for(var h=0; h<totalHours; h++){
      var row = document.createElement("div");
      row.className = "hour-row";
      var label = document.createElement("div");
      label.className = "hour-label";
      var hourVal = (VIEW_START/60) + h;
      label.textContent = (hourVal===24 ? "24" : hourVal) + ":00";
      row.appendChild(label);
      timeline.appendChild(row);
    }
    var eventsLayer = document.createElement("div");
    eventsLayer.className = "events-layer";
    timeline.appendChild(eventsLayer);
    timeline.style.height = (totalHours * HOUR_PX) + "px";

    day.events.forEach(function(ev){
      var startMin = timeToMinutes(ev.start);
      var endMin = timeToMinutes(ev.end);
      if(startMin === null && endMin === null) return;
      if(startMin === null) startMin = endMin - 30;
      if(endMin === null) endMin = startMin + 30;
      var clippedStart = Math.max(startMin, VIEW_START);
      var clippedEnd = Math.min(endMin, VIEW_END);
      if(clippedEnd <= clippedStart) clippedEnd = clippedStart + 26;

      var top = (clippedStart - VIEW_START) / 60 * HOUR_PX;
      var height = Math.max(30, (clippedEnd - clippedStart) / 60 * HOUR_PX - 4);

      var cat = categorize(ev.title);
      var block = document.createElement("div");
      block.className = "event-block cat-" + cat.key + (containsName(ev, name) ? " me" : "");
      block.style.top = top + "px";
      block.style.height = height + "px";
      block.setAttribute("tabindex","0");
      block.setAttribute("role","button");
      block.innerHTML =
        '<div class="event-time">' + fmtRange(ev) + '</div>' +
        '<div class="event-title"><span class="event-icon">' + cat.icon + '</span>' + escapeHtml(ev.title) + '</div>' +
        (containsName(ev,name) ? '<div class="event-mebadge">MY</div>' : '');
      block.addEventListener("click", function(id){
        return function(){ navigate("#/event/" + id); };
      }(ev.id));
      block.addEventListener("keydown", function(id){
        return function(e){ if(e.key==="Enter" || e.key===" ") navigate("#/event/" + id); };
      }(ev.id));
      eventsLayer.appendChild(block);
    });

    // 스와이프 (좌/우) 로 날짜 이동
    attachSwipe(document.getElementById("timelineWrap"), function(dir){
      if(dir==="left" && dayIndex < DAYS.length-1) navigate("#/day/"+(dayIndex+1));
      if(dir==="right" && dayIndex > 0) navigate("#/day/"+(dayIndex-1));
    });
  }

  function attachSwipe(el, cb){
    if(!el) return;
    var startX=0, startY=0, tracking=false;
    el.addEventListener("touchstart", function(e){
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
    }, {passive:true});
    el.addEventListener("touchend", function(e){
      if(!tracking) return;
      tracking = false;
      var dx = e.changedTouches[0].clientX - startX;
      var dy = e.changedTouches[0].clientY - startY;
      if(Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)*1.5){
        cb(dx < 0 ? "left" : "right");
      }
    }, {passive:true});
  }

  /* ---------------------------------------------------------
     3) 상세 화면
  --------------------------------------------------------- */
  function renderEventDetail(eventId, name){
    var flatIdx = FLAT_INDEX_BY_ID[eventId];
    if(flatIdx === undefined){ navigate("#/day/0"); return; }
    var item = FLAT[flatIdx];
    var ev = item.event;
    var day = DAYS[item.dayIndex];
    var cat = categorize(ev.title);
    lastDayIndex = item.dayIndex;

    var prevItem = flatIdx > 0 ? FLAT[flatIdx-1] : null;
    var nextItem = flatIdx < FLAT.length-1 ? FLAT[flatIdx+1] : null;

    var bodyHtml;
    try{
      bodyHtml = marked.parse(ev.content);
    }catch(e){
      bodyHtml = "<pre>" + escapeHtml(ev.content) + "</pre>";
    }

    var html = '' +
      '<div class="detail-screen">' +
        '<div class="detail-top">' +
          '<button class="detail-back" id="toDay">‹ 전체 일정표</button>' +
          '<button class="detail-checklist" id="toChecklist">📋 체크리스트</button>' +
        '</div>' +
        '<div class="detail-hero">' +
          '<div class="detail-eyebrow">' + cat.icon + ' 7월 ' + day.day + '일 ' + weekdayLabel(day.weekday) + ' · ' + escapeHtml(day.title) + '</div>' +
          '<h1 class="detail-title">' + escapeHtml(ev.title) + '</h1>' +
          '<div class="detail-time">' + fmtRange(ev) + '</div>' +
        '</div>' +
        '<div class="perforation"></div>' +
        '<div class="detail-body" id="detailBody">' + bodyHtml + '</div>' +
      '</div>' +
      '<div class="bottom-nav">' +
        '<button class="nav-btn" id="prevBtn" ' + (prevItem?"":"disabled") + '>◀ 이전 일정' + (prevItem?('<small>'+escapeHtml(prevItem.event.title)+'</small>'):'') + '</button>' +
        '<button class="nav-btn primary" id="dayBtn">📋 이 날 일정표</button>' +
        '<button class="nav-btn" id="nextBtn" ' + (nextItem?"":"disabled") + '>다음 일정 ▶' + (nextItem?('<small>'+escapeHtml(nextItem.event.title)+'</small>'):'') + '</button>' +
      '</div>';
    root.innerHTML = html;

    highlightName(document.getElementById("detailBody"), name);
    wrapTablesForScroll(document.getElementById("detailBody"));

    document.getElementById("toDay").addEventListener("click", function(){ navigate("#/day/"+item.dayIndex); });
    document.getElementById("toChecklist").addEventListener("click", function(){ navigate("#/checklist"); });
    document.getElementById("dayBtn").addEventListener("click", function(){ navigate("#/day/"+item.dayIndex); });
    if(prevItem) document.getElementById("prevBtn").addEventListener("click", function(){ navigate("#/event/"+prevItem.event.id); });
    if(nextItem) document.getElementById("nextBtn").addEventListener("click", function(){ navigate("#/event/"+nextItem.event.id); });

    window.scrollTo(0,0);
  }

  /* ---------------------------------------------------------
     4) 전체 핵심 체크리스트 요약 페이지
  --------------------------------------------------------- */
  function renderChecklist(name){
    var bodyHtml;
    try{
      bodyHtml = marked.parse(DATA.checklist || "");
    }catch(e){
      bodyHtml = "<pre>" + escapeHtml(DATA.checklist || "") + "</pre>";
    }

    var html = '' +
      '<div class="detail-screen">' +
        '<div class="detail-top">' +
          '<button class="detail-back" id="toDay">‹ 일정표로</button>' +
        '</div>' +
        '<div class="detail-hero">' +
          '<div class="detail-eyebrow">📌 전체 참고자료</div>' +
          '<h1 class="detail-title">핵심 체크리스트 요약</h1>' +
          '<div class="detail-time">마감 항목 · 이동/식사 계획 · 연락처 · 조편성</div>' +
        '</div>' +
        '<div class="perforation"></div>' +
        '<div class="detail-body" id="checklistBody">' + bodyHtml + '</div>' +
      '</div>' +
      '<div class="bottom-nav">' +
        '<button class="nav-btn primary" id="dayBtn2" style="flex:1">📋 일정표로 돌아가기</button>' +
      '</div>';
    root.innerHTML = html;

    highlightName(document.getElementById("checklistBody"), name);
    wrapTablesForScroll(document.getElementById("checklistBody"));

    document.getElementById("toDay").addEventListener("click", function(){ navigate("#/day/"+lastDayIndex); });
    document.getElementById("dayBtn2").addEventListener("click", function(){ navigate("#/day/"+lastDayIndex); });

    window.scrollTo(0,0);
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c];
    });
  }

  // marked 옵션: 체크박스 표시 등
  if(window.marked){
    marked.setOptions({ gfm:true, breaks:true });
  }

})();
