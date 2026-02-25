// Dữ liệu mẫu: Ngân hàng flashcard với hệ thống bài học
const flashcardsData = [
    {
        "id": "mlq1bx2d-iwnzld",
        "subject": "Tin học",
        "lesson": "SQL",
        "exam": "Đề số 1",
        "question": "Flash card của Trí",
        "answer": "Đây là câu trả lời"
    }
];

// Mapping môn học với các bài học
const lessonsBySubject = {
    "Tin học": [
        "SQL"
    ]
};

// Biến theo dõi bài học hiện tại
let currentLesson = null;
let currentSubject = 'all';
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


const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbze28V1eQPhEDh2eSDlQC0idvvBRHmIr62oQL4-tXFDwTqEXDrgeoHaG_dCGkw33QF-/exec";

async function loadFromStorage() {
    try {
        const res = await fetch(GOOGLE_SCRIPT_URL);
        if (res.ok) {
            const data = await res.json();
            applyLoadedData(data, 'Google Sheets');
        } else {
            console.error(`Lỗi khi tải dữ liệu từ Google Sheets (Status: ${res.status})`);
        }
    } catch (e) {
        console.error('Lỗi khi kết nối đến Google Sheets:', e);
    }

    ensureCardIds();

    // Cập nhật giao diện sau khi tải dữ liệu
    filterCards('all');
    updateLessons();
}

async function saveToStorage() {
    try {
        const dataToSave = {
            flashcards: flashcardsData,
            lessons: lessonsBySubject
        };
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Bỏ qua lỗi CORS của trình duyệt khi Google chuyển hướng (redirect 302)
            redirect: 'follow',
            body: JSON.stringify(dataToSave),
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            }
        });
        console.log("Đã lưu dữ liệu lên Google Sheets");
    } catch (error) {
        console.error("Lỗi khi lưu lên Google Sheets:", error);
    }
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
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
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
    // Reset lesson khi đổi môn học
    currentLesson = null;

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
    saveToStorage();
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
        saveToStorage();
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
    saveToStorage();
}

// Hàm xóa flashcard
function deleteCard(index) {
    if (index < 0 || index >= flashcardsData.length) return;

    const card = flashcardsData[index];
    const confirmed = confirm(`Bạn có chắc chắn muốn xóa thẻ câu hỏi: "${card.question.substring(0, 50)}..."?\n\nHành động này không thể hoàn tác!`);

    if (confirmed) {
        flashcardsData.splice(index, 1);
        saveToStorage();
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
        saveToStorage();

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
            <div class="list-actions">
                <button class="list-item-edit" onclick="editCardItem(${index})">Sửa</button>
                <button class="list-item-delete" onclick="deleteAndRefresh(${index})">Xóa</button>
            </div>
        `;

        listContainer.appendChild(listItem);
    });
}

// Hàm xóa từ danh sách
function deleteAndRefresh(index) {
    deleteCard(index);
    renderCardsList();
}

// ---- Chức năng Cập nhật / Chỉnh sửa Flashcard ----
let editingIndex = -1;

function createEditModal() {
    if (document.getElementById('edit-modal')) return;

    const modalHTML = `
        <div id="edit-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:9999; justify-content:center; align-items:center;">
            <div style="background:white; padding:25px; border-radius:12px; width:90%; max-width:550px; display:flex; flex-direction:column; gap:15px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
                <h3 style="color:#2c3e50; margin:0; border-bottom:2px solid #ecf0f1; padding-bottom:10px;">✏️ Chỉnh Sửa Flashcard</h3>

                <div style="display:flex; flex-direction:column; gap:5px;">
                    <label style="font-weight:600; color:#34495e;">Môn học:</label>
                    <select id="edit-subject" class="input-field" onchange="updateEditLessons()"></select>
                </div>

                <div style="display:flex; flex-direction:column; gap:5px;">
                    <label style="font-weight:600; color:#34495e;">Bài học:</label>
                    <select id="edit-lesson" class="input-field"></select>
                </div>

                <div style="display:flex; flex-direction:column; gap:5px;">
                    <label style="font-weight:600; color:#34495e;">Câu hỏi:</label>
                    <textarea id="edit-question" class="input-field" rows="3" placeholder="Nhập câu hỏi..."></textarea>
                </div>

                <div style="display:flex; flex-direction:column; gap:5px;">
                    <label style="font-weight:600; color:#34495e;">Câu trả lời:</label>
                    <textarea id="edit-answer" class="input-field" rows="3" placeholder="Nhập câu trả lời..."></textarea>
                </div>

                <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:15px;">
                    <button onclick="closeEditModal()" class="control-btn" style="background:#95a5a6; color:white; padding: 10px 20px;">Hủy</button>
                    <button onclick="saveEditCard()" class="control-btn" style="background:#f39c12; color:white; padding: 10px 20px;">Lưu Thay Đổi</button>
                </div>
            </div>
        </div>
        `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function updateEditLessons() {
    const subject = document.getElementById('edit-subject').value;
    const lessonSelect = document.getElementById('edit-lesson');
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

function editCardItem(index) {
    createEditModal();
    editingIndex = index;
    const card = flashcardsData[index];

    const subjectSelect = document.getElementById('edit-subject');
    subjectSelect.innerHTML = '<option value="">-- Chọn môn học --</option>';

    // Đổ danh sách môn học
    const mainSubjectSelect = document.getElementById('subject-select');
    Array.from(mainSubjectSelect.options).forEach(opt => {
        if (opt.value) {
            const newOpt = document.createElement('option');
            newOpt.value = opt.value;
            newOpt.textContent = opt.textContent;
            subjectSelect.appendChild(newOpt);
        }
    });

    subjectSelect.value = card.subject;
    updateEditLessons();

    // Chọn bài học, dùng setTimeout để dropdown kip render
    setTimeout(() => {
        document.getElementById('edit-lesson').value = card.lesson;
    }, 10);

    document.getElementById('edit-question').value = card.question;
    document.getElementById('edit-answer').value = card.answer;

    document.getElementById('edit-modal').style.display = 'flex';
}

function closeEditModal() {
    const modal = document.getElementById('edit-modal');
    if (modal) modal.style.display = 'none';
    editingIndex = -1;
}

function saveEditCard() {
    if (editingIndex === -1) return;

    const subject = document.getElementById('edit-subject').value;
    const lesson = document.getElementById('edit-lesson').value;
    const question = document.getElementById('edit-question').value;
    const answer = document.getElementById('edit-answer').value;

    if (!subject || !lesson || !question || !answer) {
        alert('Vui lòng điền đủ thông tin cho tất cả các trường!');
        return;
    }

    // Cập nhật dữ liệu
    flashcardsData[editingIndex].subject = subject;
    flashcardsData[editingIndex].lesson = lesson;
    flashcardsData[editingIndex].question = question;
    flashcardsData[editingIndex].answer = answer;

    saveToStorage();
    closeEditModal();

    // Làm mới UI
    filterCards(currentSubject); // Refresh state
    renderCardsList(); // Refresh list view

    alert('Cập nhật flashcard thành công!');
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
    reader.onload = function (e) {
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

                    saveToStorage();
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

    // Hide all main areas first
    document.getElementById('large-card-area').style.display = 'none';
    document.getElementById('grid-area').style.display = 'none';
    document.getElementById('exam-config-area').style.display = 'none';
    document.getElementById('exam-quiz-area').style.display = 'none';
    document.getElementById('exam-result-area').style.display = 'none';
    document.getElementById('list-area').style.display = 'none';

    if (newMode === 'learn' || newMode === 'practice') {
        document.getElementById('large-card-area').style.display = 'block';
        currentIndex = 0;
        resetOrder();
        updateTotals();
        showCard(currentIndex);
    } else if (newMode === 'exam') {
        document.getElementById('exam-config-area').style.display = 'block';
    }
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

// --- CHẾ ĐỘ THI THỬ (MÔ PHỎNG AZOTA) ---
let examQuestions = [];
let examAnswers = [];

function startExam(numQuestions) {
    if (flashcardsData.length < 4) {
        alert("Bạn cần ít nhất 4 flashcard trong ngân hàng để tạo câu hỏi trắc nghiệm!");
        return;
    }

    document.getElementById('exam-config-area').style.display = 'none';
    document.getElementById('exam-quiz-area').style.display = 'block';

    // Lấy random flashcards
    let shuffled = [...flashcardsData].sort(() => 0.5 - Math.random());
    let selectedCards = shuffled.slice(0, Math.min(numQuestions, shuffled.length));

    examQuestions = selectedCards.map(card => {
        // Tạo 3 câu trả lời sai từ các thẻ khác
        let otherCards = flashcardsData.filter(c => c.id !== card.id);
        let wrongCards = otherCards.sort(() => 0.5 - Math.random()).slice(0, 3);
        let options = [card.answer, ...wrongCards.map(c => c.answer)];
        // Xáo trộn đáp án
        options = options.sort(() => 0.5 - Math.random());

        return {
            question: card.question,
            correctAnswer: card.answer,
            options: options,
            subject: card.subject
        };
    });

    examAnswers = new Array(examQuestions.length).fill(null);
    renderExamQuestions();
}

function renderExamQuestions() {
    const container = document.getElementById('exam-questions-container');
    container.innerHTML = '';

    examQuestions.forEach((q, index) => {
        const qDiv = document.createElement('div');
        qDiv.style.background = '#f9f9f9';
        qDiv.style.padding = '20px';
        qDiv.style.borderRadius = '8px';
        qDiv.style.borderLeft = '4px solid #3498db';

        let html = `
            <div style="font-weight:bold; font-size:1.1em; color:#2c3e50; margin-bottom:15px; white-space:pre-wrap;">
                Câu ${index + 1}: ${q.question}
            </div>
            <div style="display:flex; flex-direction:column; gap:10px;">
        `;

        q.options.forEach((opt, optIndex) => {
            html += `
                <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer; padding:10px; background:white; border:1px solid #ddd; border-radius:6px; transition:all 0.2s;">
                    <input type="radio" name="exam-q-${index}" value="${optIndex}" onchange="selectExamAnswer(${index}, '${opt.replace(/'/g, "\\'")}')" style="margin-top:4px;">
                    <span style="white-space:pre-wrap;">${opt}</span>
                </label>
            `;
        });

        html += '</div>';
        qDiv.innerHTML = html;
        container.appendChild(qDiv);
    });
}

function selectExamAnswer(questionIndex, answer) {
    examAnswers[questionIndex] = answer;
}

function submitExam() {
    // Kiểm tra xem đã làm hết chưa
    let unanswered = examAnswers.filter(a => a === null).length;
    if (unanswered > 0) {
        if (!confirm(`Bạn còn ${unanswered} câu chưa trả lời. Bạn có chắc chắn muốn nộp bài?`)) {
            return;
        }
    }

    document.getElementById('exam-quiz-area').style.display = 'none';
    document.getElementById('exam-result-area').style.display = 'block';

    let correctCount = 0;
    let reviewHTML = '';

    examQuestions.forEach((q, index) => {
        let userAnswer = examAnswers[index];
        let isCorrect = userAnswer === q.correctAnswer;
        if (isCorrect) correctCount++;

        let bgColor = isCorrect ? '#d4edda' : '#f8d7da';
        let borderColor = isCorrect ? '#28a745' : '#dc3545';

        reviewHTML += `
            <div style="background:${bgColor}; border-left:4px solid ${borderColor}; padding:15px; margin-bottom:15px; border-radius:6px;">
                <div style="font-weight:bold; margin-bottom:5px;">Câu ${index + 1}: ${q.question}</div>
                <div style="margin-bottom:5px;"><strong>Bạn chọn:</strong> ${userAnswer || '(Không trả lời)'} - ${isCorrect ? '✅ Đúng' : '❌ Sai'}</div>
                ${!isCorrect ? `<div><strong>Đáp án đúng:</strong> ${q.correctAnswer}</div>` : ''}
            </div>
        `;
    });

    let score = (correctCount / examQuestions.length) * 10;
    document.getElementById('exam-score').innerText = `${score.toFixed(1)} Điểm`;
    document.getElementById('exam-feedback').innerText = `Đúng ${correctCount} / ${examQuestions.length} câu`;
    document.getElementById('exam-review-container').innerHTML = reviewHTML;
}

function exitExam() {
    examQuestions = [];
    examAnswers = [];
    document.getElementById('exam-quiz-area').style.display = 'none';
    document.getElementById('exam-result-area').style.display = 'none';
    switchMode('exam'); // Reset back to config
}
