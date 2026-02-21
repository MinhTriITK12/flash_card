// Dữ liệu mẫu: Ngân hàng flashcard với hệ thống bài học
const flashcardsData = [
    { subject: 'Toán', lesson: 'Bài 1: Đại số', question: 'Công thức tính diện tích hình tròn?', answer: 'S = π × r²' },
    { subject: 'Toán', lesson: 'Bài 1: Đại số', question: 'Đạo hàm của sin(x) là gì?', answer: 'cos(x)' },
    { subject: 'Toán', lesson: 'Bài 2: Hình học', question: 'Tổng góc trong tam giác bằng bao nhiêu?', answer: '180°' },
    { subject: 'Toán', lesson: 'Bài 2: Hình học', question: 'Công thức Pythagoras là gì?', answer: 'a² + b² = c²' },
    { subject: 'Tiếng Anh', lesson: 'Bài 1: Văn phạm', question: 'Thì hiện tại hoàn thành có cấu trúc thế nào?', answer: 'S + have/has + V(past participle)' },
    { subject: 'Tiếng Anh', lesson: 'Bài 1: Văn phạm', question: 'Từ vựng: "Môi trường" trong tiếng Anh?', answer: 'Environment' },
    { subject: 'Tiếng Anh', lesson: 'Bài 2: Giao tiếp', question: 'Cách hỏi về tên?', answer: 'What is your name?' },
    { subject: 'Tiếng Anh', lesson: 'Bài 2: Giao tiếp', question: 'Cách chào hỏi buổi chiều?', answer: 'Good afternoon!' },
    { subject: 'Tin học', lesson: 'Bài 1: Web cơ bản', question: 'HTML là viết tắt của cụm từ gì?', answer: 'HyperText Markup Language' },
    { subject: 'Tin học', lesson: 'Bài 1: Web cơ bản', question: 'CSS dùng để làm gì?', answer: 'Định dạng và trang trí giao diện web' },
    { subject: 'Tin học', lesson: 'Bài 2: Cấu trúc dữ liệu', question: 'Cấu trúc dữ liệu "Stack" hoạt động theo nguyên tắc nào?', answer: 'LIFO (Last In, First Out)' },
    { subject: 'Tin học', lesson: 'Bài 2: Cấu trúc dữ liệu', question: 'Queue hoạt động theo nguyên tắc nào?', answer: 'FIFO (First In, First Out)' }
];

// Mapping môn học với các bài học
const lessonsBySubject = {
    'Toán': ['Bài 1: Đại số', 'Bài 2: Hình học'],
    'Tiếng Anh': ['Bài 1: Văn phạm', 'Bài 2: Giao tiếp'],
    'Tin học': ['Bài 1: Web cơ bản', 'Bài 2: Cấu trúc dữ liệu']
};

// Biến theo dõi bài học hiện tại
let currentLesson = null;
let currentSubject = 'all';
let currentExamSet = null; // currently selected exam set name
let examSets = {}; // { 'Đề 1': [id1, id2, ...] }

// Broadcast channel for syncing across tabs
let broadcastChannel = null;
let lastUpdatedLocal = null;

try {
    broadcastChannel = new BroadcastChannel('flashcards_channel');
    broadcastChannel.onmessage = (event) => {
        if (event.data.type === 'updated') {
            loadFromStorage();
            showCard(currentIndex);
        }
    };
} catch (e) {
    console.log('BroadcastChannel not supported');
}


// Persistence helpers: save/load from server API
async function loadFromStorage() {
    let dataLoaded = false;

    // 1. Ưu tiên tải từ file flashcards.json trực tiếp
    try {
        // Thêm timestamp để tránh cache
        const res = await fetch('flashcards.json?t=' + new Date().getTime());
        if (res.ok) {
            const data = await res.json();
            applyLoadedData(data, 'file flashcards.json');
            dataLoaded = true;
        } else {
            console.log(`Không tìm thấy flashcards.json (Status: ${res.status})`);
        }
    } catch (e) {
        console.warn('Lỗi khi đọc file flashcards.json:', e);
    }

    // 1b. Thử tải từ server Node.js (nếu bạn đang chạy 'node server.js')
    if (!dataLoaded) {
        try {
            const res = await fetch('http://localhost:5000/flashcards');
            if (res.ok) {
                const data = await res.json();
                applyLoadedData(data, 'Server Node.js (Port 5000)');
                dataLoaded = true;
            }
        } catch (e) {
            console.log('Không kết nối được server Node.js (Port 5000). Hãy chạy "node server.js" hoặc dùng Live Server.');
        }
    }

    // 2. Nếu vẫn không có dữ liệu, dùng dữ liệu mẫu trong script
    if (!dataLoaded) {
        console.log('Sử dụng dữ liệu mẫu mặc định.');
    }

    ensureCardIds();
    
    // Cập nhật giao diện sau khi tải dữ liệu
    filterCards('all');
    updateLessons();
    if (typeof updateExamTabs === 'function') updateExamTabs();
}

function applyLoadedData(data, source) {
    if (!data) return;

    // Cập nhật flashcards
    if (Array.isArray(data.flashcards)) {
        flashcardsData.length = 0;
        data.flashcards.forEach(it => flashcardsData.push(it));
    }

    // Cập nhật bài học
    if (data.lessons) {
        Object.keys(lessonsBySubject).forEach(key => delete lessonsBySubject[key]);
        Object.keys(data.lessons).forEach(subject => {
            lessonsBySubject[subject] = data.lessons[subject];
        });
    }

    // Cập nhật đề thi
    examSets = {};
    if (data.examSets) {
        examSets = data.examSets;
    } else {
        // Tự động tạo examSets từ thuộc tính 'exam' trong flashcards (nếu có)
        flashcardsData.forEach(card => {
            if (card.exam) {
                if (!examSets[card.exam]) examSets[card.exam] = [];
                examSets[card.exam].push(card.id);
            }
        });
    }

    if (data.exportedAt) {
        lastUpdatedLocal = data.exportedAt;
    }
    console.log(`✅ Đã tải dữ liệu thành công từ ${source}`);
}

function ensureCardIds() {
    for (let i = 0; i < flashcardsData.length; i++) {
        if (!flashcardsData[i].id) {
            flashcardsData[i].id = generateId();
        }
    }
}

function generateId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8);
}

// Hàm hiển thị danh sách thẻ
function renderCards(cards) {
    // Grid area render (used in "grid-area")
    const gridArea = document.getElementById('grid-area');
    gridArea.innerHTML = ''; // Xóa các thẻ cũ trước khi hiển thị mới
    
    cards.forEach((card, index) => {
        // Tạo wrapper để chứa delete button
        const wrapper = document.createElement('div');
        wrapper.classList.add('flashcard-wrapper');
        
        // Tạo thẻ div cho mỗi flashcard
        const cardEl = document.createElement('div');
        cardEl.classList.add('flashcard');
        
        // Thêm cấu trúc HTML bên trong
        cardEl.innerHTML = `
            <div class="card-inner">
                <div class="card-front">
                    <span class="subject-tag">${card.subject}</span>
                    <h3>${card.question}</h3>
                </div>
                <div class="card-back">
                    <span class="subject-tag">${card.subject}</span>
                    <p>${card.answer}</p>
                </div>
            </div>
        `;
        
        // Thêm nút delete
        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('delete-btn');
        deleteBtn.innerHTML = '✕';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            const cardIndex = flashcardsData.indexOf(card);
            if (cardIndex > -1) {
                deleteCard(cardIndex);
            }
        };
        
        // Thêm sự kiện click để lật thẻ
        cardEl.addEventListener('click', () => {
            cardEl.classList.toggle('flipped');
        });
        
        // Thêm card và delete button vào wrapper
        wrapper.appendChild(cardEl);
        wrapper.appendChild(deleteBtn);
        
        // Đẩy wrapper vào giao diện
        gridArea.appendChild(wrapper);
    });
}

// Hàm hiển thị thẻ cho bài học cụ thể
function renderCardsByLesson(cards) {
    renderCards(cards); // Sử dụng hàm renderCards hiện có
    resetOrder();
    if (cards.length > 0) {
        currentIndex = 0;
        showCard(0);
    }
}

// Hàm lọc thẻ theo môn học hoặc bài học
function filterCards(subject) {
    currentSubject = subject || 'all';
    // Reset lesson và exam khi đổi môn học
    currentLesson = null;
    currentExamSet = null;

    document.querySelectorAll('.lesson-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    updateLessonButtons(subject);
    applyFilters(); // Gọi hàm lọc tổng hợp
}

// Cập nhật nút bài học
function updateLessonButtons(subject) {
    const lessonButtonsDiv = document.getElementById('lesson-buttons');
    lessonButtonsDiv.innerHTML = '';
    
    if (subject === 'all') {
        // Hiển thị tất cả bài học từ lessonsBySubject
        const allLessons = new Set();
        for (let subj in lessonsBySubject) {
            lessonsBySubject[subj].forEach(lesson => {
                allLessons.add(lesson);
            });
        }
        allLessons.forEach(lesson => {
            createLessonButton(lesson, lessonButtonsDiv);
        });
    } else if (subject && lessonsBySubject[subject]) {
        lessonsBySubject[subject].forEach(lesson => {
            createLessonButton(lesson, lessonButtonsDiv);
        });
    }
}

function createLessonButton(lesson, container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'lesson-btn-wrapper';
    
    const btn = document.createElement('button');
    btn.className = 'lesson-btn';
    btn.textContent = lesson;
    btn.onclick = () => selectLesson(lesson);
    
    if (currentLesson === lesson) {
        btn.classList.add('active');
    }
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'lesson-delete-btn';
    deleteBtn.innerHTML = '✕';
    deleteBtn.title = 'Xóa bài học này';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        deleteLesson(lesson);
    };
    
    wrapper.appendChild(btn);
    wrapper.appendChild(deleteBtn);
    container.appendChild(wrapper);
}

function selectLesson(lesson) {
    // Nếu click lại bài đang chọn thì bỏ chọn (toggle)
    if (currentLesson === lesson) {
        currentLesson = null;
    } else {
        currentLesson = lesson;
    }
    
    // Reset đề thi khi đổi bài học
    currentExamSet = null;
    
    updateLessonButtonsUI();
    applyFilters();
}

function updateLessonButtonsUI() {
    document.querySelectorAll('.lesson-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === currentLesson);
    });
}

// Hàm lọc tổng hợp (Core Logic mới)
function applyFilters() {
    let filtered = flashcardsData;

    // 1. Lọc theo Môn học
    if (currentSubject && currentSubject !== 'all') {
        filtered = filtered.filter(card => card.subject === currentSubject);
    }

    // 2. Lọc theo Bài học
    if (currentLesson) {
        filtered = filtered.filter(card => card.lesson === currentLesson);
    }

    // Cập nhật danh sách Đề thi dựa trên dữ liệu đã lọc (Môn + Bài)
    // Điều này giúp chỉ hiện các Đề có trong Bài học này
    updateExamTabs(filtered);

    // 3. Lọc theo Đề thi (nếu đang chọn đề)
    if (currentExamSet) {
        // Lọc các thẻ có thuộc tính exam trùng khớp
        filtered = filtered.filter(card => card.exam === currentExamSet);
    }

    renderCardsByLesson(filtered);
    
    // Reset order với dữ liệu lọc
    // Lưu ý: flashcardsData.indexOf có thể trả về -1 nếu filtered là bản copy, 
    // nhưng ở đây filter trả về tham chiếu object gốc nên vẫn ổn.
    order = filtered.map(card => flashcardsData.indexOf(card)).filter(idx => idx !== -1);
    
    if (isShuffled) shuffleOrder();
    currentIndex = 0;
    updateTotals();
    if (filtered.length > 0) {
        showCard(0);
    } else {
        // Xử lý khi không có thẻ nào
        document.getElementById('flip-card').innerHTML = '<div style="text-align: center; color: #888; padding-top: 50px;">Không có thẻ nào phù hợp</div>';
        document.getElementById('total-count').textContent = '0';
        document.getElementById('current-index').textContent = '0';
    }
}

function updateLessons() {
    const subjectSelect = document.getElementById('subject-select');
    const lessonSelect = document.getElementById('lesson-select');
    const subject = subjectSelect.value;
    
    lessonSelect.innerHTML = '<option value="">-- Chọn bài học --</option>';
    
    if (subject && lessonsBySubject[subject]) {
        lessonsBySubject[subject].forEach(lesson => {
            const option = document.createElement('option');
            option.value = lesson;
            option.textContent = lesson;
            lessonSelect.appendChild(option);
        });
    }
}

// Hàm toggle form thêm bài học
function toggleAddLessonForm() {
    const form = document.getElementById('add-lesson-form');
    if (form) {
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
    }
}

// Hàm thêm bài học mới
function addNewLesson() {
    const subject = document.getElementById('new-lesson-subject').value;
    const lessonName = document.getElementById('new-lesson-name').value;
    
    if (!subject || !lessonName) {
        alert('Vui lòng chọn môn học và nhập tên bài học!');
        return;
    }
    
    // Tạo tên bài học đầy đủ
    const fullLessonName = `${lessonName}`;
    
    // Kiểm tra xem bài học đã tồn tại chưa
    if (lessonsBySubject[subject] && lessonsBySubject[subject].includes(fullLessonName)) {
        alert('Bài học này đã tồn tại!');
        return;
    }
    
    // Thêm bài học mới vào danh sách
    if (!lessonsBySubject[subject]) {
        lessonsBySubject[subject] = [];
    }
    lessonsBySubject[subject].push(fullLessonName);
    
    // Clear form
    document.getElementById('new-lesson-subject').value = '';
    document.getElementById('new-lesson-name').value = '';
    
    // Đóng form
    toggleAddLessonForm();
    
    alert('Thêm bài học thành công! Bạn có thể thêm câu hỏi cho bài học này.');
}

// Hàm xóa bài học
function deleteLesson(lesson) {
    // Kiểm tra xem có bao nhiêu flashcard thuộc bài học này
    const cardsInLesson = flashcardsData.filter(card => card.lesson === lesson).length;
    
    let message = `Bạn có chắc chắn muốn xóa bài học: "${lesson}"?`;
    
    if (cardsInLesson > 0) {
        message += `\n\nCảnh báo: Sẽ có ${cardsInLesson} flashcard bị xóa theo!\n\nHành động này không thể hoàn tác!`;
    }
    
    const confirmed = confirm(message);
    
    if (confirmed) {
        // Xóa tất cả flashcard thuộc bài học này (mutate array in-place)
        for (let i = flashcardsData.length - 1; i >= 0; i--) {
            if (flashcardsData[i].lesson === lesson) {
                flashcardsData.splice(i, 1);
            }
        }

        // Xóa bài học khỏi lessonsBySubject
        for (let subject in lessonsBySubject) {
            const index = lessonsBySubject[subject].indexOf(lesson);
            if (index > -1) {
                lessonsBySubject[subject].splice(index, 1);
                if (lessonsBySubject[subject].length === 0) delete lessonsBySubject[subject];
                break;
            }
        }

        // Reset lesson selection nếu bài học bị xóa đang được chọn
        if (currentLesson === lesson) currentLesson = null;

        // Cập nhật giao diện
        filterCards('all');

        alert('Xóa bài học thành công!');
    }
}

// Hàm thêm flashcard mới
function addNewCard() {
    const subject = document.getElementById('subject-select').value;
    const lesson = document.getElementById('lesson-select').value;
    const question = document.getElementById('question-input').value;
    const answer = document.getElementById('answer-input').value;
    
    // Kiểm tra nếu tất cả các trường đều được điền
    if (!subject || !lesson || !question || !answer) {
        alert('Vui lòng điền đủ thông tin cho tất cả các trường!');
        return;
    }
    
    // Thêm thẻ mới vào dữ liệu (với id)
    flashcardsData.push({
        id: generateId(),
        subject: subject,
        lesson: lesson,
        question: question,
        answer: answer
    });

    // Xóa trường input
    document.getElementById('subject-select').value = '';
    document.getElementById('lesson-select').value = '';
    document.getElementById('question-input').value = '';
    document.getElementById('answer-input').value = '';
    
    // Hiển thị lại tất cả các thẻ
    filterCards('all');
    
    alert('Thêm flashcard thành công!');
}

// Hàm xóa flashcard
function deleteCard(index) {
    if (index < 0 || index >= flashcardsData.length) return;
    
    const card = flashcardsData[index];
    const confirmed = confirm(`Bạn có chắc chắn muốn xóa thẻ câu hỏi: "${card.question.substring(0, 50)}..."?\n\nHành động này không thể hoàn tác!`);
    
    if (confirmed) {
        flashcardsData.splice(index, 1);
        // saveToStorage(); // Removed as per user's request
        alert('Đã xóa thẻ thành công!');
        filterCards('all');
        renderCardsList();
        return;
    }
}

// Hàm xóa thẻ hiện tại
function deleteCurrentCard() {
    if (!flashcardsData.length) {
        alert('Không có thẻ nào để xóa!');
        return;
    }
    
    const idx = order[currentIndex];
    const card = flashcardsData[idx];
    const confirmed = confirm(`Bạn có chắc chắn muốn xóa thẻ câu hỏi:\n\n"${card.question}"\n\nHành động này không thể hoàn tác!`);
    
    if (confirmed) {
        flashcardsData.splice(idx, 1);
        // saveToStorage();
        
        // Reset index if needed
        if (currentIndex >= flashcardsData.length) {
            currentIndex = Math.max(0, flashcardsData.length - 1);
        }
        
        resetOrder();
        updateTotals();
        
        if (flashcardsData.length > 0) {
            showCard(currentIndex);
        } else {
            document.getElementById('flip-card').innerHTML = '<div style="color: #888;">Không còn thẻ nào</div>';
        }
        
        renderCardsList();
        alert('Xóa flashcard thành công!');
    }
}

// Hàm toggle giữa chế độ học và danh sách
function toggleViewMode() {
    const largeCardArea = document.getElementById('large-card-area');
    const listArea = document.getElementById('list-area');
    
    if (listArea.style.display === 'none') {
        largeCardArea.style.display = 'none';
        listArea.style.display = 'block';
        renderCardsList();
    } else {
        listArea.style.display = 'none';
        largeCardArea.style.display = 'block';
    }
}

// Hàm render danh sách thẻ
function renderCardsList() {
    const listContainer = document.getElementById('list-container');
    listContainer.innerHTML = '';
    
    if (flashcardsData.length === 0) {
        listContainer.innerHTML = '<div style="text-align: center; color: #7f8c8d; padding: 20px;">Không có flashcard nào</div>';
        return;
    }
    
    flashcardsData.forEach((card, index) => {
        const listItem = document.createElement('div');
        listItem.className = 'list-item';
        
        listItem.innerHTML = `
            <div class="list-item-content">
                <div class="list-item-question">${card.question}</div>
                <div class="list-item-meta">
                    <span class="list-item-subject">${card.subject}</span>
                    <span class="list-item-lesson">${card.lesson}</span>
                </div>
            </div>
            <button class="list-item-delete" onclick="deleteAndRefresh(${index})">Xóa</button>
        `;
        
        listContainer.appendChild(listItem);
    });
}

// Hàm xóa từ danh sách
function deleteAndRefresh(index) {
    deleteCard(index);
    renderCardsList();
}


function exportData() {
    const dataToExport = {
        flashcards: flashcardsData,
        lessons: lessonsBySubject,
        examSets: examSets,
        exportedAt: new Date().toLocaleString('vi-VN')
    };

    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `flashcards.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert('Đã xuất dữ liệu thành công! Bạn có thể thay thế file flashcards.json bằng file này.');
}

// Hàm nhập dữ liệu từ file JSON
function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (data.flashcards && Array.isArray(data.flashcards)) {
                const confirmed = confirm('Dữ liệu hiện tại sẽ được thay thế bằng dữ liệu từ file. Tiếp tục?');
                
                if (confirmed) {
                    flashcardsData.length = 0;
                    data.flashcards.forEach(card => flashcardsData.push(card));
                    
                    if (data.lessons) {
                        Object.keys(lessonsBySubject).forEach(key => delete lessonsBySubject[key]);
                        Object.keys(data.lessons).forEach(subject => {
                            lessonsBySubject[subject] = data.lessons[subject];
                        });
                    }
                    
                    // saveToStorage(); // Removed as per user's request
                    filterCards('all');
                    alert('Nhập dữ liệu thành công!');
                }
            } else {
                alert('File không hợp lệ. Vui lòng kiểm tra lại!');
            }
        } catch (error) {
            alert('Lỗi khi đọc file: ' + error.message);
        }
    };
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
}

// ---- New: Large-card / navigation / modes ----
let mode = 'learn'; // 'learn' | 'practice' | 'exam'
let currentIndex = 0;
let isShuffled = false;
let order = flashcardsData.map((_, i) => i);
let autoplay = false;
let autoplayTimer = null;

const largeCardEl = document.getElementById('large-card');
const totalCountEl = document.getElementById('total-count');
const currentIndexEl = document.getElementById('current-index');
const progressBarEl = document.getElementById('progress-bar');

function switchMode(newMode) {
    mode = newMode;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === newMode));
    document.getElementById('large-card-area').style.display = (newMode === 'learn' || newMode === 'practice' || newMode === 'exam') ? 'block' : 'none';
    document.getElementById('grid-area').style.display = (newMode === 'learn') ? 'none' : 'none';
    // For simplicity, show grid when user picks a separate view later. For now, "learn" uses large card.
    // Reset index when switching mode
    currentIndex = 0;
    resetOrder();
    updateTotals();
    showCard(currentIndex);
}

function resetOrder() {
    order = flashcardsData.map((_, i) => i);
    if (isShuffled) shuffleOrder();
}

function shuffleOrder() {
    for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
}

function updateTotals() {
    // Nếu đang xem bài học cụ thể, tính số lượng thẻ của bài đó
    let dataToUse = flashcardsData;
    if (currentLesson) {
        dataToUse = flashcardsData.filter(card => card.lesson === currentLesson);
    }
    
    totalCountEl.textContent = dataToUse.length;
    currentIndexEl.textContent = Math.min(currentIndex + 1, dataToUse.length);
    const pct = dataToUse.length ? ((currentIndex + 1) / dataToUse.length) * 100 : 0;
    progressBarEl.style.width = pct + '%';
}

function showCard(i) {
    if (!flashcardsData.length) { 
        const flipCard = document.getElementById('flip-card');
        if (flipCard) flipCard.innerHTML = '<div style="text-align: center; color: #888;">Không có thẻ nào</div>';
        return;
    }
    const idx = order[i];
    const card = flashcardsData[idx];
    
    // Reset flip state
    const flipCard = document.getElementById('flip-card');
    if (flipCard) {
        flipCard.classList.remove('flipped');
        
        const frontSubject = flipCard.querySelector('.flip-card-front .subject-tag');
        const backSubject = flipCard.querySelector('.flip-card-back .subject-tag');
        const frontLesson = flipCard.querySelector('.flip-card-front .lesson-tag');
        const backLesson = flipCard.querySelector('.flip-card-back .lesson-tag');
        const question = flipCard.querySelector('.question');
        const answer = flipCard.querySelector('.answer');
        
        if (frontSubject) frontSubject.textContent = card.subject;
        if (backSubject) backSubject.textContent = card.subject;
        if (frontLesson) frontLesson.textContent = card.lesson;
        if (backLesson) backLesson.textContent = card.lesson;
        if (question) question.textContent = card.question;
        if (answer) answer.textContent = card.answer;
    }
    
    updateTotals();
}

function flipLargeCard() {
    const flipCard = document.getElementById('flip-card');
    if (flipCard) {
        flipCard.classList.toggle('flipped');
    }
}

function nextCard() {
    if (!flashcardsData.length) return;
    currentIndex = (currentIndex + 1) % flashcardsData.length;
    showCard(currentIndex);
}

function prevCard() {
    if (!flashcardsData.length) return;
    currentIndex = (currentIndex - 1 + flashcardsData.length) % flashcardsData.length;
    showCard(currentIndex);
}

function toggleShuffle() {
    isShuffled = !isShuffled;
    document.getElementById('shuffle-btn').classList.toggle('active', isShuffled);
    resetOrder();
    showCard(currentIndex);
}

function togglePlay() {
    autoplay = !autoplay;
    const btn = document.getElementById('play-btn');
    btn.textContent = autoplay ? '▌▌' : '▶';
    if (autoplay) {
        autoplayTimer = setInterval(() => { nextCard(); }, 3000);
    } else {
        clearInterval(autoplayTimer);
        autoplayTimer = null;
    }
}

function toggleFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
        el.requestFullscreen && el.requestFullscreen();
    } else {
        document.exitFullscreen && document.exitFullscreen();
    }
}

// Keyboard shortcuts: left/right arrows, space to flip
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; // skip when typing
    if (e.key === 'ArrowRight') { nextCard(); }
    else if (e.key === 'ArrowLeft') { prevCard(); }
    else if (e.code === 'Space') { e.preventDefault(); flipLargeCard(); }
});

// Click on flip card to flip
const flipCard = document.getElementById('flip-card');
if (flipCard) {
    flipCard.addEventListener('click', flipLargeCard);
}

// Initial setup: load persisted data, then initialize order and UI
loadFromStorage();
resetOrder();
updateTotals();
showCard(0);

// Initialize lesson buttons for "all" view
filterCards('all');

// Also render grid area for quick overview
renderCards(flashcardsData);

// init exam tabs UI
function updateExamTabs(availableCards) {
    const container = document.getElementById('exam-tabs-container');
    if (!container) return;
    container.innerHTML = '';

    // Nếu không truyền availableCards (lần đầu load), dùng toàn bộ data
    const sourceData = availableCards || flashcardsData;

    // Tìm tất cả các đề thi có trong dữ liệu hiện tại (Môn/Bài đã chọn)
    const availableExams = new Set();
    sourceData.forEach(card => {
        if (card.exam) availableExams.add(card.exam);
    });

    // Nếu không có đề nào trong bài học này, ẩn container hoặc hiện thông báo?
    // Ở đây ta vẫn hiện nút "Tất cả"

    // Tất cả
    const allBtn = document.createElement('button');
    allBtn.className = 'exam-tab-btn';
    allBtn.textContent = 'Tất cả đề';
    allBtn.onclick = () => selectExamSet(null);
    if (!currentExamSet) allBtn.classList.add('active');
    container.appendChild(allBtn);

    // Chỉ render các đề có trong context hiện tại
    Array.from(availableExams).sort().forEach(name => {
        const btn = document.createElement('button');
        btn.className = 'exam-tab-btn';
        btn.textContent = name;
        btn.onclick = () => selectExamSet(name);
        if (currentExamSet === name) btn.classList.add('active');

        // Ẩn nút xóa đề trong chế độ xem lọc để giao diện gọn hơn, 
        // hoặc giữ nguyên tùy bạn. Ở đây tôi giữ nguyên logic hiển thị.
        container.appendChild(btn);
    });
}

function addExamSetFromCurrentCard() {
    const input = document.getElementById('new-exam-name');
    if (!input) return;
    const name = input.value && input.value.trim();
    if (!name) { alert('Nhập tên đề!'); return; }

    // collect ids from current view
    let visible = flashcardsData;
    if (currentExamSet) {
        visible = flashcardsData.filter(c => examSets[currentExamSet] && examSets[currentExamSet].includes(c.id));
    } else if (currentLesson) {
        visible = flashcardsData.filter(c => c.lesson === currentLesson);
    } else if (currentSubject && currentSubject !== 'all') {
        visible = flashcardsData.filter(c => c.subject === currentSubject);
    }

    const ids = visible.map(c => c.id);
    if (ids.length === 0) { if (!confirm('Đề rỗng — vẫn tạo?')) return; }
    examSets[name] = ids;
    // saveToStorage(); // Removed as per user's request
    renderExamSetDropdown();
    input.value = '';
    alert('Đã thêm đề: ' + name + ' (' + ids.length + ' thẻ)');
}

function deleteExamSet(name) {
    if (!examSets[name]) return;
    delete examSets[name];
    saveToStorage();
    if (currentExamSet === name) currentExamSet = null;
    updateExamTabs();
    filterCards(currentSubject || 'all');
}

function selectExamSet(name) {
    // Nếu click lại đề đang chọn thì bỏ chọn (về tất cả)
    if (currentExamSet === name) {
        currentExamSet = null;
    } else {
        currentExamSet = name;
    }
    
    applyFilters();
}

// render exam tabs after initial load
updateExamTabs();

// --- DEBUG: Expose helpers for console ---
window.debugDeleteLesson = function(name) {
    if (!name) { alert('Nhập tên bài học!'); return; }
    if (typeof deleteLesson === 'function') deleteLesson(name);
    else alert('Không tìm thấy hàm deleteLesson!');
};
window.debugDeleteCardByQuestion = function(question) {
    if (!question) { alert('Nhập câu hỏi!'); return; }
    const idx = flashcardsData.findIndex(card => card.question === question);
    if (idx > -1) deleteCard(idx);
    else alert('Không tìm thấy flashcard với câu hỏi này!');
};
window.debugClearAll = function() {
    if (confirm('Xóa toàn bộ dữ liệu?')) {
        localStorage.removeItem('flashcards');
        localStorage.removeItem('lessonsBySubject');
        location.reload();
    }
};

// --- EXAM TAB LOGIC (placeholder) ---
// TODO: Implement exam tab filtering logic here