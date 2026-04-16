const express = require('express')
const app = express();
app.use(express.json());

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');
db.run("PRAGMA foreign_keys = ON");

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS livros (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titulo TEXT,
            autor TEXT,
            ano INTEGER,
            genero TEXT,
            nota REAL,
            fav INTEGER
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS comentarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_livro INTEGER NOT NULL,
            texto TEXT,
            FOREIGN KEY (id_livro) REFERENCES livros(id) ON DELETE CASCADE
        )
    `);

    db.get("SELECT COUNT(*) as total FROM livros", (err, row) => {
        if (row.total === 0) {
            db.run(`INSERT INTO livros (titulo, autor, ano, genero, nota, fav) VALUES
                ("Alice no País das Maravilhas", "Lewis Carroll", 1865, "Nonsense", 5, 1),
                ("Alice Através do Espelho", "Lewis Carroll", 1871, "Nonsense", 4.7, 0),
                ("Wicked", "Gregory Maguire", 1995, "Fantasia", 4.2, 0),
                ("O Pequeno Príncipe", "Antoine de Saint-Exupéry", 1943, "Infanto-Juvenil", 5, 0),
                ("Percy Jackson e o Ladrão de Raios", "Rick Riordan", 2005, "Fantasia", 4.7, 0),
                ("O Mágico de Oz", "L. Frank Baum", 1900, "Fantasia", 4.6, 0),
                ("A Divina Comédia", "Dante Alighieri", 1321, "Ficção", 4.7, 1),
                ("Memórias Póstumas de Brás Cubas", "Machado de Assis", 1881, "Ficção", 5, 0),
                ("Dom Casmurro", "Machado de Assis", 1899, "Ficção", 4.9, 0),
                ("Quincas Borba", "Machado de Assis", 1891, "Ficção", 4.8, 0),
                ("Harry Potter e a Pedra Filosofal", "J.K. Rowling", 1997, "Fantasia", 4.9, 0),
                ("Harry Potter e a Câmara Secreta", "J.K. Rowling", 1998, "Fantasia", 4.8, 0),
                ("O Hobbit", "J.R.R. Tolkien", 1937, "Fantasia", 4.9, 0),
                ("O Senhor dos Anéis", "J.R.R. Tolkien", 1954, "Fantasia", 5, 0),
                ("Coraline", "Neil Gaiman", 2002, "Fantasia", 4.6, 0),
                ("As Crônicas de Nárnia", "C.S. Lewis", 1950, "Fantasia", 4.7, 0),
                ("Frankenstein", "Mary Shelley", 1818, "Ficção", 4.5, 0),
                ("Drácula", "Bram Stoker", 1897, "Ficção", 4.6, 0),
                ("1984", "George Orwell", 1949, "Ficção", 4.8, 1),
                ("A Revolução dos Bichos", "George Orwell", 1945, "Ficção", 4.7, 0);
            `);
        }
    });

    db.get("SELECT COUNT(*) as total FROM comentarios", (err, row) => {
        if (row.total === 0) {
            db.run(`INSERT INTO comentarios (id_livro, texto) VALUES
                (1, "Livro muito bom!")
            `);
        }
    });
});

app.get('/api/livros', (req, res) => {
    const { genero, nota_min, ano_max, ano_min, ordem, direcao, pagina = 1, limite = 10 } = req.query;

    let query = "SELECT * FROM livros";
    let params = [];

    if (genero) {
        query += " AND genero = ?";
        params.push(genero);
    }

    if (nota_min) {
        query += " AND nota >= ?";
        params.push(parseFloat(nota_min));
    }

    if (ano_max) {
        query += " AND ano <= ?";
        params.push(parseInt(ano_max));
    }

    if (ano_min) {
        query += " AND ano >= ?";
        params.push(parseInt(ano_min));
    }

    if (ordem) {
        const direcaoSQL = direcao === 'desc' ? 'DESC' : 'ASC';

        if (ordem === 'nota' || ordem === 'titulo') query += ` ORDER BY ${ordem} ${direcaoSQL}`;
    }

    const paginaNum = parseInt(pagina);
    if (paginaNum<1) paginaNum=1;
    const limiteNum = parseInt(limite);
    if (limiteNum<1) limiteNum=10;
    const offset = (paginaNum - 1) * limiteNum;

    query += " LIMIT ? OFFSET ?";
    params.push(limiteNum, offset);

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json(err);

        let countQuery = "SELECT COUNT(*) as total FROM livros WHERE 1=1";
        let countParams = [];

        if (genero) {
            countQuery += " AND genero = ?";
            countParams.push(genero);
        }

        if (nota_min) {
            countQuery += " AND nota >= ?";
            countParams.push(parseFloat(nota_min));
        }

        if (ano_max) {
            countQuery += " AND ano <= ?";
            countParams.push(parseInt(ano_max));
        }

        if (ano_min) {
            countQuery += " AND ano >= ?";
            countParams.push(parseInt(ano_min));
        }

        db.get(countQuery, countParams, (err2, countResult) => {
            if (err2) return res.status(500).json(err2);

            res.json({
                dados: rows,
                paginacao: {
                    pagina_atual: paginaNum,
                    itens_por_pagina: limiteNum,
                    total_itens: countResult.total,
                    total_paginas: Math.ceil(countResult.total / limiteNum)
                }
            });
        });
    });
});

app.get('/api/livros/procurar/:id', (req, res) => {
    const id = parseInt(req.params.id);

    db.get("SELECT * FROM livros WHERE id = ?", [id], (err, row) => {
        if (err) return res.status(500).json(err);

        if (!row) return res.status(404).json({ erro: "Livro não encontrado" });

        res.json(row);
    });
});

app.get('/api/livros/titulo/:titulo', (req, res) => {
    const titulo = req.params.titulo;

    db.get("SELECT * FROM livros WHERE titulo = ?", [titulo], (err, row) => {
        if (err) return res.status(500).json(err);

        if (!row) return res.status(404).json({ erro: "Título não encontrado" });

        res.json(row);
    });
});

app.get('/api/livros/favoritos', (req, res) => {
    db.all("SELECT * FROM livros WHERE fav = 1", [], (err, rows) => {
        if (err) return res.status(500).json(err);

        if (rows.length === 0) return res.status(404).json({ erro: "Não há algum livro marcado como favorito" });

        res.status(200).json(rows);
    });
});

app.get('/api/livros/comentarios/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const query = `
        SELECT livros.id, livros.titulo, comentarios.id AS comentario_id, comentarios.texto
        FROM livros
        LEFT JOIN comentarios ON livros.id = comentarios.id_livro
        WHERE livros.id = ?
    `;
    db.all(query, [id], (err, rows) => {
        if (err) return res.status(500).json(err);

        if (rows.length===0) return res.status(404).json({ erro: "Livro não encontrado" });
        
        let comentarios = []
        rows.forEach(r => {
            if (r.comentario_id){
                comentarios.push({
                    id: r.comentario_id,
                    texto: r.texto
                });
            }
        });
        
        const livroProcurado = {
            id: rows[0].id,
            titulo: rows[0].titulo,
            comentarios: comentarios
        };

        res.status(200).json(livroProcurado);
    });
});

app.post('/api/livros', (req, res) => {
    const { titulo, autor, ano, genero, nota } = req.body;

    if (!titulo || !autor || ano === undefined || !genero || nota === undefined) return res.status(400).json({ erro: "Todos os campos são obrigatórios: titulo, autor, ano, genero, nota" });

    if (ano > 2026) return res.status(400).json({ erro: "Um livro não pode ter sido publicado nesse ano ainda" });

    if (nota < 0 || nota > 5) return res.status(400).json({ erro: "A nota deve estar entre 0 e 5" });
    
    const params = [titulo, autor, ano, genero, nota];

    db.run(`INSERT INTO livros (titulo, autor, ano, genero, nota, fav) VALUES (?, ?, ?, ?, ?, 0`, params, function (err) {
        if (err) return res.status(500).json(err);

        const novoLivro = {
            id: this.lastID,
            titulo,
            autor,
            ano,
            genero,
            nota,
            fav: 0
        };

        res.status(201).json(novoLivro);
    });
});

app.post('/api/livros/duplicar', (req, res) => {
    const { id } = req.body;

    if (id === undefined) return res.status(400).json({ erro: "O campo é obrigatório: id" });
    
    db.get("SELECT * FROM livros WHERE id = ?", [id], (err, row) => {
        if (err) return res.status(500).json(err);

        if(!row) return res.status(404).json({ erro: "Livro não encontrado" });

        const params = [row.titulo + " Cópia", row.autor, row.ano, row.genero, row.nota];

        db.run(`INSERT INTO livros (titulo, autor, ano, genero, nota, fav) VALUES (?, ?, ?, ?, ?, 0`, params, function (err2) {
            if (err2) return res.status(500).json(err2);

            const novoLivro = {
                id: this.lastID,
                titulo,
                autor,
                ano,
                genero,
                nota,
                fav: 0
            };

            res.status(201).json(novoLivro);
        });
    });
});

app.post('/api/livros/resetar-favoritos', (req, res) => {
    db.all("SELECT * FROM livros WHERE fav = 1", [], (err, rows) => {
        if (err) return res.status(500).json(err);

        if (!rows || rows.length===0) return res.status(404).json({ erro: "Não há nenhum livro favoritado" });

        db.run("UPDATE livros SET fav = 0 WHERE fav = 1", [], (err2) => {
            if (err2) return res.status(500).json(err2);

            res.status(200).json(rows);
        });
    });
});

app.post('/api/livros/adicionar-comentario/:id', (req, res) => {
    const { comentario } = req.body;
    const idLivro = parseInt(req.params.id);

    if (!comentario) return res.status(400).json({ erro: "O campo é obrigatório: comentario" });

    db.get("SELECT * FROM livros WHERE id = ?", [idLivro], (err, livro) => {
        if (err) return res.status(500).json(err);

        if (!livro) return res.status(404).json({ erro: "Livro não encontrado" });
        db.run("INSERT INTO comentarios (id_livro, texto) VALUES (?, ?)", [idLivro, comentario], function (err2) {
                if (err2) return res.status(500).json(err2);

                const comentarioId = this.lastID;
                
                db.get("SELECT * FROM comentarios WHERE id = ?", [comentarioId], (err3, comentario) => {
                    if (err3) return res.status(500).json(err3);

                    res.status(201).json({
                        comentario,
                        livro
                    });
                });
            }
        );
    });
});

app.put('/api/livros/editar-tudo/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { titulo, autor, ano, genero, nota } = req.body;

    if (!titulo) return res.status(404).json({ erro: "O campo é obrigatório: título"});
    if (!autor) return res.status(404).json({ erro: "O campo é obrigatório: autor"});
    if (ano === undefined || ano>2026) return res.status(404).json({ erro: "O campo é obrigatório: ano"});
    if (!genero) return res.status(404).json({ erro: "O campo é obrigatório: gênero"});
    if (nota === undefined || nota<0 || nota>5) return res.status(404).json({ erro: "O campo é obrigatório: nota"});

    db.run("UPDATE livros SET titulo = ?, autor = ?, ano = ?, genero = ?, nota = ? WHERE id = ?", [titulo, autor, ano, genero, nota, id], (err) => {
        if (err) return res.status(500).json(err);

        const livroEditado = {
                id,
                titulo,
                autor,
                ano,
                genero,
                nota,
                fav: 0
        };

        res.status(200).json(livroEditado);
    });
});

app.patch('/api/livros/editar/:id', (req, res) => {
    const id = parseInt(req.params.id);
    let { titulo, autor, ano, genero, nota } = req.body;

    db.get("SELECT * FROM livros WHERE id = ?", [id], (err, row) => {
        if (err) return res.status(500).json(err);

        if(!row) return res.status(404).json({ erro: "Livro não encontrado"})

        if (!titulo) titulo = row.titulo;
        if (!autor) autor = row.autor;
        if (ano === undefined || ano>2026) ano = row.ano;
        if (!genero) genero = row.genero;
        if (nota === undefined || nota<0 || nota>5) nota = row.nota;

        db.run("UPDATE livros SET titulo = ?, autor = ?, ano = ?, genero = ?, nota = ? WHERE id = ?", [titulo, autor, ano, genero, nota, id], (err2) => {
            if (err2) return res.status(500).json(err2);

            const livroEditado = {
                    id,
                    titulo,
                    autor,
                    ano,
                    genero,
                    nota,
                    fav: 0
            };

            res.status(200).json(livroEditado);
        });
    });
});

app.patch('/api/livros/favoritar', (req, res) => {
    const { id } = req.body;

    db.get("SELECT * FROM livros WHERE id = ?", [id], (err, row) => {
        if (err) return res.status(500).json(err);

        if (row.fav === 1) return res.status(404).json({ erro: "O livro já está favoritado" });

        db.run("UPDATE livros SET fav = 1 WHERE id = ?", [id], (err2) => {
            if (err2) return res.status(500).json(err2);
            res.status(200).json(row);
        });
    });
});

app.patch('/api/livros/desfavoritar', (req, res) => {
    const { id } = req.body;

    db.get("SELECT * FROM livros WHERE id = ?", [id], (err, row) => {
        if (err) return res.status(500).json(err);

        if (row.fav === 0) return res.status(404).json({ erro: "O livro já é desfavoritado" });

        db.run("UPDATE livros SET fav = 0 WHERE id = ?", [id], (err2) => {
            if (err2) return res.status(500).json(err2);
            res.status(200).json(row);
        });
    });
});

app.delete('/api/livros/deletar', (req, res) => {
    const { id } = req.body;

    if (id === undefined) return res.status(400).json({ erro: "O campo é obrigatório: id" });

    db.get("SELECT * FROM livros WHERE id = ?", [id], (err, row) => {
        if (err) return res.status(500).json(err);

        if (!row) return res.status(404).json({ erro: "Livro não encontrado" });

        db.run("DELETE FROM livros WHERE id = ?", [id], (err2) => {
            if (err2) return res.status(500).json(err2);

            res.status(200).json(row);
        });
    });
});

app.delete('/api/livros/deletar-nao-favoritos', (req, res) => {
    db.all("SELECT * FROM livros WHERE fav = 0", [], (err, rows) => {
        if (err) return res.status(500).json(err);

        if (rows.length === 0) return res.status(400).json({ erro: "Todos os livros estão favoritados" });

        db.run("DELETE FROM livros WHERE fav = 0", [], (err2) => {
            if (err2) return res.status(500).json(err2);
            res.status(200).json(rows);
        });
    });
});

app.delete('/api/livros/deletar-comentarios', (req, res) => {
    const { id } = req.body;

    if (!id) return res.status(400).json({ erro: "O campo é obrigatório: id" });

    db.get("SELECT * FROM livros WHERE id = ?", [id], (err, row) => {
        if (err) return res.status(500).json(err);

        if (!row) return res.status(404).json({ erro: "Livro não encontrado" });

        db.all("SELECT * FROM comentarios WHERE id_livro = ?", [id], (err2, rows) => {
            if (err2) return res.status(500).json(err2);

            if (rows.length === 0) return res.status(400).json({ erro: "O livro não tem comentários" });
                
            db.run("DELETE FROM comentarios WHERE id_livro = ?", [id], (err3) => {
                if (err3) return res.status(500).json(err3);

                res.status(200).json({
                    row,
                    comentarios_removidos: rows
                });
            });
        });
    });
});

app.delete('/api/livros/deletar-comentarios-por-id/:id', (req, res) => {
    const idLivro = parseInt(req.params.id);
    const { id } = req.body;

    if (!id) return res.status(400).json({ erro: "O campo é obrigatório: id" });

    db.get("SELECT * FROM livros WHERE id = ?", [idLivro], (err, row) => {
        if (err) return res.status(500).json(err);

        if (!row) return res.status(404).json({ erro: "Livro não encontrado" });

        db.get("SELECT * FROM comentarios WHERE id = ? AND id_livro = ?", [id, idLivro], (err2, row2) => {
            if (err2) return res.status(500).json(err2);

            if (!row2) return res.status(400).json({ erro: "Comentário não encontrado" });
    
            db.run("DELETE FROM comentarios WHERE id = ? AND id_livro = ?", [id, idLivro], (err3) => {
                if (err3) return res.status(500).json(err3);

                res.status(200).json({
                    row,
                    comentario_removido: row2
                });
            });
        });
    });
});

app.delete('/api/livros/resetar', (req, res) => {
    db.all("SELECT * FROM livros", [], (err, rows) => {
        if (err) return res.status(500).json(err);

        db.run("DELETE FROM livros", [], (err2) => {
            if (err2) return res.status(500).json(err2);
        });

        if (rows.lenght === 0) {
            db.run(`INSERT INTO livros (titulo, autor, ano, genero, nota, fav) VALUES
                ("Alice no País das Maravilhas", "Lewis Carroll", 1865, "Nonsense", 5, 1),
                ("Alice Através do Espelho", "Lewis Carroll", 1871, "Nonsense", 4.7, 0),
                ("Wicked", "Gregory Maguire", 1995, "Fantasia", 4.2, 0),
                ("O Pequeno Príncipe", "Antoine de Saint-Exupéry", 1943, "Infanto-Juvenil", 5, 0),
                ("Percy Jackson e o Ladrão de Raios", "Rick Riordan", 2005, "Fantasia", 4.7, 0),
                ("O Mágico de Oz", "L. Frank Baum", 1900, "Fantasia", 4.6, 0),
                ("A Divina Comédia", "Dante Alighieri", 1321, "Ficção", 4.7, 1),
                ("Memórias Póstumas de Brás Cubas", "Machado de Assis", 1881, "Ficção", 5, 0),
                ("Dom Casmurro", "Machado de Assis", 1899, "Ficção", 4.9, 0),
                ("Quincas Borba", "Machado de Assis", 1891, "Ficção", 4.8, 0),
                ("Harry Potter e a Pedra Filosofal", "J.K. Rowling", 1997, "Fantasia", 4.9, 0),
                ("Harry Potter e a Câmara Secreta", "J.K. Rowling", 1998, "Fantasia", 4.8, 0),
                ("O Hobbit", "J.R.R. Tolkien", 1937, "Fantasia", 4.9, 0),
                ("O Senhor dos Anéis", "J.R.R. Tolkien", 1954, "Fantasia", 5, 0),
                ("Coraline", "Neil Gaiman", 2002, "Fantasia", 4.6, 0),
                ("As Crônicas de Nárnia", "C.S. Lewis", 1950, "Fantasia", 4.7, 0),
                ("Frankenstein", "Mary Shelley", 1818, "Ficção", 4.5, 0),
                ("Drácula", "Bram Stoker", 1897, "Ficção", 4.6, 0),
                ("1984", "George Orwell", 1949, "Ficção", 4.8, 1),
                ("A Revolução dos Bichos", "George Orwell", 1945, "Ficção", 4.7, 0);
            `);
        }

        res.status(200).json(rows);
    });
});

app.delete('/api/livros/deletar-tudo', (req, res) => {
    db.all("SELECT * FROM livros", [], (err, rows) => {
        if (err) return res.status(500).json(err);

        db.run("DELETE FROM livros", [], (err2) => {
            if (err2) return res.status(500).json({err2: err2});

            res.status(200).json(rows);
        });
    });
});

app.listen(3000, () => console.log('API rodando na porta 3000'));