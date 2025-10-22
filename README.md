# CV & Project Report Evaluation System

<img width="641"  height="267" alt="Screenshot 2025-10-22 at 18 44 14" src="https://github.com/user-attachments/assets/7d89e5ac-9431-466c-86ef-62b562f681d3" />


Sistem ini digunakan untuk mengevaluasi **CV** dan **Project Report** secara otomatis menggunakan Large Language Model (LLM).  
Prosesnya mencakup upload dokumen, pemrosesan teks dari PDF, retrieval konteks dengan RAG, dan penyajian hasil evaluasi berupa skor dan feedback.

---

## Data Flow Overview



### 1. Upload Phase
- **Client** mengupload file **CV** dan **Project Report** dalam format PDF.  
- File disimpan secara **lokal** di folder `uploads/`.  
- Metadata file seperti nama, path, dan timestamp disimpan di **SQLite database**.

> Contoh alur:
> ```
> if user uploads files:
>     save files to /uploads
>     insert metadata (filename, path, uploaded_at) into SQLite
> ```

---

### 2. Evaluation Trigger
- Setelah upload selesai, **client** menekan tombol “Evaluate”.  
- Sistem akan membuat **job** baru di **Bull queue** yang menggunakan **Redis** sebagai penyimpanan job state.  
- Job ini berisi referensi file dan metadata untuk diproses oleh worker.

> ```
> if user clicks "Evaluate":
>     create new job in Redis queue
> ```

---

### 3. Processing Phase (Worker)
- **Worker** akan otomatis mengambil job dari queue.  
- Worker mengekstrak teks dari file PDF yang diupload.  
- Setelah itu, worker melakukan **retrieval RAG context** (misalnya mengambil contoh CV atau rubric dari knowledge base).  
- Worker memanggil **LLM** secara bertahap (chain of calls) untuk:
  - Mengevaluasi isi CV dan report
  - Menghasilkan skor penilaian
  - Memberikan feedback berbasis konteks RAG

> ```
> if worker gets new job:
>     extract pdf text
>     retrieve rag context
>     call LLM chain
>     save evaluation result to database
> ```

---

### 4. Result Phase
- **Client** dapat memeriksa hasil evaluasi dengan memanggil endpoint hasil atau melalui polling status job.  
- Sistem akan mengembalikan **evaluation scores** dan **feedback text** yang dihasilkan oleh LLM.

> ```
> if client polls for result:
>     fetch evaluation result from SQLite
>     return {score, feedback}
> ```

---

## ⚙️ Tech Stack

- **Backend:** Node.js + Express  
- **Database:** SQLite (local metadata & results)  
- **Queue:** Bull + Redis  
- **LLM Integration:** OpenAI / Claude / Local LLM (sesuai konfigurasi)  
- **File Handling:** Multer (untuk upload PDF)  
- **PDF Parsing:** pdf-parse  
- **RAG Context Retrieval:** Chroma DB

---

## Project Setup & Run Guide

Berikut langkah-langkah menjalankan proyek setelah di-clone:

### 1. Clone Repository
```bash
git clone 
cd project-name
````

### 2. Install Dependencies

Pastikan Node.js dan npm sudah terinstall di sistem.

```bash
npm install
```

### 3. Setup Environment Variables

Buat file `.env` di root folder:

```env
PORT=3000
NODE_ENV=development
REDIS_URL=redis://localhost:6379
DATABASE_PATH=./database.db
UPLOAD_DIR=./uploads
LOG_DIR=./logs

LLM_PROVIDER=
GROQ_API_KEY=
GROQ_MODEL=
```

### 4. Start Redis Server

Jalankan Redis secara lokal (atau gunakan Docker):

```bash
redis-server
# atau
docker run -d -p 6379:6379 redis
```

### 5. Start Server

```bash
node src/server
# atau
node server (tergantung path)
```


## Notes

* Worker dan server bisa dijalankan di mesin berbeda selama menggunakan Redis yang sama.
* Jika ingin mengganti LLM provider (misalnya dari OpenAI ke Claude), cukup ubah `llmService.js` dan API key di `.env`.
* SQLite cocok untuk prototipe lokal. Untuk produksi bisa diganti PostgreSQL.



