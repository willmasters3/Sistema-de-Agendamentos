const express = require('express');
const router = express.Router();
const sql = require('mssql');
const path = require('path');
const multer = require('multer');
const config = require('../dbConfig');
const moment = require('moment');
const bcrypt = require('bcrypt');
const { DateTime } = require('luxon'); 
const Fuse = require('fuse.js');

// Importa o módulo de agendamento
let pool;

sql.connect(config)
    .then(p => {
        pool = p;
        console.log('Conectado ao banco de dados');
    })
    .catch(err => console.error('Erro ao conectar ao banco de dados:', err));
 

// Configurar o multer para upload de arquivos

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../imagens')); // Path correto
    },
    filename: function (req, file, cb) {
        cb(null, `image-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage });




// Rota para a página inicial feito (publico)
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html')); // Ajustando o caminho correto
    
});
router.get('/registro'), (req,res)=>{
    res.sendFile(path.join(__dirname, '../private/html','registro.html' ));
}
// Rota para obter unidades feito 
router.get('/unidades', async (req, res) => {
    try {
        let result = await pool.request().query('SELECT codigo_unidade, nome_unidade FROM Unidades');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Registro de um novo professor
// Registro de um novo professor
router.post('/register', async (req, res) => {
    const { nome, matricula, login, senha, permissao, unidades } = req.body;

    try {
        // 1. Verificar se o professor já existe
        const existingProfessor = await pool.request()
            .input('matricula', sql.NVarChar, matricula)
            .query('SELECT * FROM professores WHERE matricula = @matricula');

        if (existingProfessor.recordset.length > 0) {
            // 2. Se o professor já existe, verificar associações
            const professor = existingProfessor.recordset[0];
            const existingAssociations = await pool.request()
                .input('id_professor', sql.Int, professor.id_professor)
                .query('SELECT * FROM ProfessorUnidade WHERE id_professor = @id_professor');

            // 3. Verificar se o novo código da unidade já está associado
            const newAssociations = [];

            for (const codigoUnidade of unidades) {
                if (!existingAssociations.recordset.some(a => a.codigo_unidade === codigoUnidade)) {
                    newAssociations.push(codigoUnidade);
                    
                }
            }

            // 4. Se há novas associações (unidades), adicioná-las
            for (const codigoUnidade of newAssociations) {
                await pool.request()
                    .input('id_professor', sql.Int, professor.id_professor)
                    .input('codigo_unidade', sql.NVarChar, codigoUnidade)
                    .query('INSERT INTO ProfessorUnidade (id_professor, codigo_unidade) VALUES (@id_professor, @codigo_unidade)');
            }

            return res.status(200).send('Professor já existe e foi associado a novas unidades, se necessário.');
        }

        // 5. Se o professor não existe, prosseguir com a criação normal
        const hashedPassword = await bcrypt.hash(senha, 10);
        const result = await pool.request()
            .input('nome', sql.NVarChar, nome)
            .input('matricula', sql.NVarChar, matricula)
            .input('login', sql.NVarChar, login)
            .input('senha', sql.NVarChar, hashedPassword)
            .input('permissao', sql.NVarChar, permissao)
            .query(`INSERT INTO professores (nome, matricula, login, senha, permissao) 
                    OUTPUT INSERTED.id_professor
                    VALUES (@nome, @matricula, @login, @senha, @permissao)`);

        const idProfessor = result.recordset[0].id_professor;

        // 6. Associar unidades ao novo professor
        for (const codigoUnidade of unidades) {
            await pool.request()
                .input('id_professor', sql.Int, idProfessor)
                .input('codigo_unidade', sql.NVarChar, codigoUnidade)
                .query(`INSERT INTO ProfessorUnidade (id_professor, codigo_unidade) 
                        VALUES (@id_professor, @codigo_unidade)`);
        }

        res.status(201).send('Professor cadastrado com sucesso.');
    } catch (error) {
        console.error('Erro ao registrar professor:', error);
        res.status(500).send('Erro ao registrar professor.');
    }
});

//NOVO
// Rota para verificar se a matrícula já existe
router.get('/verificar-matricula/:matricula', async (req, res) => {
    const { matricula } = req.params;
    try {
        const result = await pool.request()
            .input('matricula', sql.NVarChar, matricula) // Utiliza a matrícula recebida
            .query('SELECT * FROM professores WHERE matricula = @matricula');

        // Se existir um registro, retorna as informações do professor
        if (result.recordset.length > 0) {
            res.json(result.recordset[0]); // Retorna a primeira entrada correspondente
        } else {
            res.json(null); // Indica que a matrícula não existe
        }
    } catch (error) {
        console.error('Erro ao verificar matrícula:', error);
        res.status(500).send('Erro ao verificar matrícula.');
    }
});

// Rota para registro de um novo coordenador
router.post('/register-coordenador', async (req, res) => {
    const { nome, matricula, login, senha, unidades } = req.body;

    try {
        // 1. Verificar se o coordenador já existe
        const existingCoordenador = await pool.request()
            .input('matricula', sql.NVarChar, matricula)
            .query('SELECT * FROM professores WHERE matricula = @matricula');

        if (existingCoordenador.recordset.length > 0) {
            return res.status(409).send('Coordenador já existe.');
        }

        // 2. Registrar o novo coordenador
        const hashedPassword = await bcrypt.hash(senha, 10);
        const result = await pool.request()
            .input('nome', sql.NVarChar, nome)
            .input('matricula', sql.NVarChar, matricula)
            .input('login', sql.NVarChar, login)
            .input('senha', sql.NVarChar, hashedPassword)
            .input('permissao', sql.NVarChar, 'coordenador') // Definindo permissão como coordenador
            .query(`INSERT INTO professores (nome, matricula, login, senha, permissao)
                    OUTPUT INSERTED.id_professor
                    VALUES (@nome, @matricula, @login, @senha, @permissao)`);

        const idCoordenador = result.recordset[0].id_professor;

        // 3. Associar unidades ao novo coordenador
        for (const codigoUnidade of unidades) {
            await pool.request()
                .input('id_professor', sql.Int, idCoordenador)
                .input('codigo_unidade', sql.NVarChar, codigoUnidade)
                .query(`INSERT INTO ProfessorUnidade (id_professor, codigo_unidade) 
                        VALUES (@id_professor, @codigo_unidade)`);
        }

        res.status(201).send('Coordenador cadastrado com sucesso.');
    } catch (error) {
        console.error('Erro ao registrar coordenador:', error);
        res.status(500).send('Erro ao registrar coordenador.');
    }
});


// Rota para login

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .query('SELECT * FROM professores WHERE login = @username');

        if (result.recordset.length === 0) {
            return res.status(401).send('Usuário ou senha inválidos.');
        }

        const user = result.recordset[0];
        const match = await bcrypt.compare(password, user.senha);

        if (!match) {
            return res.status(401).send('Usuário ou senha inválidos.');
        }

        // Buscando as associações na tabela ProfessorUnidade
        const unidadesResult = await pool.request()
            .input('id_professor', sql.Int, user.id_professor)
            .query('SELECT codigo_unidade FROM ProfessorUnidade WHERE id_professor = @id_professor');

        const unidades = unidadesResult.recordset.map(row => row.codigo_unidade);

        // Armazenar as informações do usuário na sessão
        req.session.user = {
            id_professor: user.id_professor,
            nome: user.nome,
            login: user.login,
            permissao: user.permissao,
            unidades // Armazenar todas as unidades associadas
        };

        // Redirecionamento baseado no tipo de usuário
        if (user.permissao === 'admin') {
            return res.send('/html/dashboard.html'); 
        } else if (user.permissao === 'coordenador') {
            return res.send('/html/dashboard-coordenador.html'); // Novo caminho para a dashboard do coordenador
        } else {
            return res.send('/html/dashboardagenda.html'); // Para outros usuários, como usuários comuns
        }
    } catch (err) {
        console.error('Erro ao fazer login:', err);
        res.status(500).send('Erro ao fazer login.');
    }
});




// Rota para obter dados do usuário logado
router.get('/user-info', (req, res) => {
    if (req.session.user) {
        return res.json(req.session.user); // Envia os dados do usuário logado
    } else {
        return res.status(401).send('Usuário não autenticado.');
    }
});



//altera a senha
router.put('/alterar-senha/:id', async (req, res) => {
    const { id } = req.params;
    const { novaSenha } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(novaSenha, 10);
        
        await pool.request()
            .input('id', sql.Int, id)
            .input('senha', sql.NVarChar, hashedPassword)
            .query('UPDATE professores SET senha = @senha WHERE id_professor = @id');

        res.status(200).send('Senha alterada com sucesso.');
    } catch (err) {
        console.error('Erro ao alterar a senha:', err);
        res.status(500).send('Erro ao alterar a senha.');
    }
});
// Rota para listar as 10 salas mais agendadas
router.get('/top-salas', async (req, res) => {
    try {
        const result = await pool.request()
            .query(`
                SELECT TOP 10 nome_sala, COUNT(*) AS quantidade
                FROM agendamentos
                JOIN Salas ON agendamentos.id_sala = Salas.id_sala
                GROUP BY nome_sala
                ORDER BY quantidade DESC
            `);
        
        res.json(result.recordset); // Retorna as salas com suas quantidades
    } catch (error) {
        console.error('Erro ao listar as salas:', error);
        res.status(500).send('Erro ao listar as salas.');
    }
});


// Rota para obter salas por código da unidade
router.get('/salas/:codigoUnidade', async (req, res) => {
    const { codigoUnidade } = req.params;
    try {
        let result = await pool.request()
            .input('codigoUnidade', sql.VarChar, codigoUnidade)
            .query(`
                SELECT s.id_sala, s.nome_sala, u.codigo_unidade, u.nome_unidade 
                FROM Salas s 
                JOIN Unidades u ON s.codigo_unidade = u.codigo_unidade 
                WHERE s.codigo_unidade = @codigoUnidade
            `
        /*
        // este const retorna salas administrativas que nao sao academicas
        const salasAdministrativas = await pool.request()
        .input('codigoUnidade', sql.VarChar, codigoUnidade)
        .query(`
        SELECT id_sala,
      nome_sala
      ,codigo_unidade
        FROM SalasAdministrativas
        WHERE codigo_unidade = @codigoUnidade

        */
        );
        res.json(result.recordset);
    } catch (err) {
        console.error('Erro ao obter salas:', err);
        res.status(500).send(err.message);
    }
});

// Rota para obter salas administrativa por código da unidade
router.get('/SalasAdministrativas/:codigoUnidade', async (req, res) => {
    const { codigoUnidade } = req.params;
    try {
        let result = await pool.request()
            .input('codigoUnidade', sql.VarChar, codigoUnidade)
            .query(`
                SELECT s.id_sala, s.nome_sala, u.codigo_unidade
                FROM SalasAdministrativas s 
                JOIN Unidades u ON s.codigo_unidade = u.codigo_unidade 
                WHERE s.codigo_unidade = @codigoUnidade
            `);
        res.json(result.recordset);
    } catch (err) {
        console.error('Erro ao obter salas:', err);
        res.status(500).send(err.message);
    }
    /*
    SELECT TOP (1000) [id_sala]
      ,[nome_sala]
      ,[codigo_unidade]
      ,[area]
      ,[recursos]
      ,[imagem]
  FROM [ProjetoSenai2.0].[dbo].[SalasAdministrativas]
 */
});

// Rota para obter detalhes de uma sala feito
router.get('/sala/:idSala', async (req, res) => {
    const { idSala } = req.params;
    try {
        let result = await pool.request()
            .input('idSala', sql.Int, idSala)
            .query('SELECT * FROM Salas WHERE id_sala = @idSala');
        res.json(result.recordset[0]);
    } catch (err) {
        res.status(500).send(err.message);
    }
});


//rota para agendamento
router.post('/agendar-sala', async (req, res) => {
    const { id_sala, id_professor, data_reservas, hora_inicio, hora_fim, motivo, tipo_aula } = req.body; // Aqui falta a captura de tipo_aula

    console.log('Recebendo dados para agendamento:', req.body);

    if (!id_sala || !id_professor || !Array.isArray(data_reservas) || !hora_inicio || !hora_fim || !motivo || !tipo_aula) {
        return res.status(400).send('Dados incompletos ou inválidos');
    }

    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        for (const data of data_reservas) {
            const dataLuxon = DateTime.fromISO(data);

            if (!dataLuxon.isValid) {
                throw new Error('Data inválida.');
            }

            const conflitos = await transaction.request()
                .input('id_sala', sql.Int, id_sala)
                .input('data', sql.NVarChar, data)
                .input('hora_inicio', sql.NVarChar, hora_inicio)
                .input('hora_fim', sql.NVarChar, hora_fim)
                .query(`
                    SELECT COUNT(*) AS numConflictos
                    FROM agendamentos
                    WHERE id_sala = @id_sala
                    AND data_reservas = @data
                    AND (
                        (hora_inicio < @hora_fim AND hora_fim > @hora_inicio)
                    )
                `);

            if (conflitos.recordset[0].numConflictos > 0) {
                await transaction.rollback();
                const partesData = data.split('-');
                const dataFormatada = `${partesData[2]} de ${['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro',
                     'outubro', 'novembro', 'dezembro'][parseInt(partesData[1], 10) - 1]} de ${partesData[0]}`;

                return res.status(400).send(`Data (${dataFormatada}) e horário já ocupados. Escolha outro, por gentileza.`);
            }

            await transaction.request()
                .input('id_sala', sql.Int, id_sala)
                .input('id_professor', sql.Int, id_professor)
                .input('data_reservas', sql.NVarChar, data)
                .input('hora_inicio', sql.NVarChar, hora_inicio)
                .input('hora_fim', sql.NVarChar, hora_fim)
                .input('tipo_aula', sql.NVarChar, tipo_aula) // Aqui você precisa incluir tipo_aula
                .input('motivo', sql.NVarChar, motivo)
                .query(`
                    INSERT INTO agendamentos (id_sala, id_professor, data_reservas, hora_inicio, hora_fim, motivo, tipo_aula) 
                    VALUES (@id_sala, @id_professor, @data_reservas, @hora_inicio, @hora_fim, @motivo, @tipo_aula)
                `);
        }

        await transaction.commit();
        res.status(200).send('Agendamentos criados com sucesso!');
    } catch (error) {
        console.error('Erro ao criar agendamentos:', error);
        
        if (transaction) {
            await transaction.rollback(); // Rollback em caso de erro
        }
        
        if (error.message === 'Data inválida.') {
            return res.status(400).send('Data inválida.');
        }

        res.status(500).send('Erro ao criar agendamentos.');
    }
});


//Rota dentro do alteraagenda editor de multiplos e simples


router.put('/editar-agendamento/:id', async (req, res) => {
    const { id } = req.params;
    const { professor, tipoAtividade, motivo } = req.body; // Pegamos todos os campos

    try {
        const query = `
            UPDATE agendamentos 
            SET 
                id_professor = @professor,
                tipo_aula = @tipoAtividade,
                motivo = @motivo 
            WHERE id_agendamento = @id
        `;

        await pool.request()
            .input('id', sql.Int, id)
            .input('professor', sql.Int, professor)
            .input('tipoAtividade', sql.NVarChar, tipoAtividade)
            .input('motivo', sql.NVarChar, motivo)
            .query(query);

        res.status(200).send('Agendamento atualizado com sucesso.');
    } catch (error) {
        console.error('Erro ao editar agendamento:', error);
        res.status(500).send('Erro ao editar agendamento.');
    }
});
// Rota para editar apenas o professor de um agendamento
router.put('/editar-professor-agendamento/:id', async (req, res) => {
    const { id } = req.params;
    const { professor } = req.body; // Apenas o novo professor

    try {
        const query = `
            UPDATE agendamentos 
            SET 
                id_professor = @professor
            WHERE id_agendamento = @id
        `;

        await pool.request()
            .input('id', sql.Int, id)
            .input('professor', sql.Int, professor)
            .query(query);

        res.status(200).send('Professor do agendamento atualizado com sucesso.');
    } catch (error) {
        console.error('Erro ao editar professor do agendamento:', error);
        res.status(500).send('Erro ao editar professor do agendamento.');
    }
});

// Rota para editar os detalhes de UMA Unidade Curricular
router.get('/unidade-curricular/:idUc', async (req, res) => {
    const { idUc } = req.params;
    try {
        const result = await pool.request()
            .input('idUc', sql.Int, idUc)
            .query(`
                SELECT id_unidade_curricular, ano, semestre, turma, turno, modulo, tipo_curso, codigo_unidade
                FROM UnidadesCurriculares
                WHERE id_unidade_curricular = @idUc
            `);
            
        if (result.recordset.length === 0) {
            return res.status(404).send('Unidade Curricular não encontrada.');
        }

        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Erro ao buscar detalhes da UC:', error);
        res.status(500).send('Erro ao buscar detalhes da UC.');
    }
});
router.put('/unidade-curricular/:idUc', async (req, res) => {
    const { idUc } = req.params;
    const { ano, semestre, turma, turno, modulo, tipoCurso, codigoUnidade } = req.body; 

    try {
        await pool.request()
            .input('idUc', sql.Int, idUc)
            .input('ano', sql.Int, ano)
            .input('semestre', sql.Int, semestre)
            .input('turma', sql.NVarChar(1), turma)
            .input('turno', sql.Int, turno)
            .input('modulo', sql.Int, modulo)
            .input('tipoCurso', sql.Int, tipoCurso)
            .input('codigoUnidade', sql.NVarChar, codigoUnidade)
            .query(`
                UPDATE UnidadesCurriculares
                SET 
                    ano = @ano, 
                    semestre = @semestre, 
                    turma = @turma, 
                    turno = @turno, 
                    modulo = @modulo, 
                    tipo_curso = @tipoCurso,
                    codigo_unidade = @codigoUnidade
                WHERE id_unidade_curricular = @idUc
            `);

        res.status(200).send('Unidade Curricular atualizada com sucesso!');
    } catch (error) {
        console.error('Erro ao editar UC:', error);
        res.status(500).send('Erro ao editar Unidade Curricular.');
    }
});
// Rota para listar tipos de aula por unidade

router.get('/listar-tipos-aula-por-unidade/:codigoUnidade', async (req, res) => {
    const { codigoUnidade } = req.params; // Pega o parâmetro da URL
    try {
        const result = await pool.request()
            .input('codigoUnidade', sql.NVarChar, codigoUnidade) // Aqui você declara e atribui a variável
            .query(`
                SELECT ta.id_tipo_aula, ta.descricao
                FROM unidade_tipo_aula uta 
                JOIN tipos_aula ta ON uta.id_tipo_aula = ta.id_tipo_aula
                JOIN Unidades u ON uta.id_unidade = u.codigo_unidade
                WHERE u.codigo_unidade = @codigoUnidade;
            `);
        if (result.recordset.length === 0) {
            return res.status(404).send('Nenhum tipo de aula encontrado para esta unidade.');
        }
        res.json(result.recordset); // Retorna os resultados como JSON
    } catch (err) {
        console.error('Erro ao listar tipos de aula:', err);
        res.status(500).send('Erro ao listar tipos de aula.');
    }
});

// Rota para editar um tipo de aula (CORRIGIDA)
router.put('/editar-tipo-aula/:idTipoAula', async (req, res) => {
    const { descricao } = req.body;
    const { idTipoAula } = req.params;

    try {
        // Atualiza apenas a descrição na tabela tipos_aula (Correto!)
        const result = await pool.request()
            .input('descricao', sql.VarChar, descricao)
            .input('idTipoAula', sql.Int, idTipoAula)
            .query('UPDATE tipos_aula SET descricao = @descricao WHERE id_tipo_aula = @idTipoAula');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).send('Tipo de aula não encontrado.');
        }

        // Não precisa mais do bloco de atualização na tabela 'unidade_tipo_aula' aqui.

        res.send('Tipo de aula editado com sucesso!');
    } catch (error) {
        console.error('Erro ao editar tipo de aula:', error);
        res.status(500).send('Erro ao editar tipo de aula.');
    }
});
// Rota para adicionar um novo tipo de aula e associá-lo a uma unidade
router.post('/adicionar-unidade-tipo-aula', async (req, res) => {
    const { descricao, id_unidade } = req.body;

    // Verifica se a descrição e a unidade foram passadas
    if (!descricao || !id_unidade || typeof id_unidade !== 'string') { // Verificamos que é uma string
        return res.status(400).send('Descrição e ID da unidade são obrigatórios e ID deve ser uma string.');
    }

    try {
        // Incluir a descrição na tabela tipos_aula
        const resultTipoAula = await pool.request()
            .input('descricao', sql.NVarChar(255), descricao)
            .query('INSERT INTO tipos_aula (descricao) VALUES (@descricao); SELECT SCOPE_IDENTITY() AS id_tipo_aula;');

        const id_tipo_aula = resultTipoAula.recordset[0].id_tipo_aula;

        // Associar o tipo de aula à unidade
        await pool.request()
            .input('id_unidade', sql.NVarChar, id_unidade) // Mantém como nvarchar
            .input('id_tipo_aula', sql.Int, id_tipo_aula)
            .query('INSERT INTO unidade_tipo_aula (id_unidade, id_tipo_aula) VALUES (@id_unidade, @id_tipo_aula);');

        res.status(201).send('Tipo de aula adicionado e associado à unidade com sucesso!');
    } catch (error) {
        console.error('Erro ao adicionar e associar tipo de aula:', error);
        res.status(500).send('Erro ao adicionar e associar tipo de aula.');
    }
});

// Rota para dessassociar um tipo de aula de todas as unidades
router.delete('/dessassociar-tipo-aula/:idTipoAula', async (req, res) => {
    const { idTipoAula } = req.params;

    try {
        await pool.request()
            .input('idTipoAula', sql.Int, idTipoAula)
            .query('DELETE FROM unidade_tipo_aula WHERE id_tipo_aula = @idTipoAula');

        res.sendStatus(200);
    } catch (error) {
        console.error('Erro ao dessassociar tipo de aula:', error);
        res.status(500).send('Erro ao dessassociar tipo de aula.');
    }
});
// Rota para desassociar professor de uma unidade
router.delete('/desassociar-professor/:id/:codigo_unidade', async (req, res) => {
    const { id, codigo_unidade } = req.params;

    try {
        await pool.request()
            .input('id_professor', sql.Int, id)
            .input('codigo_unidade', sql.NVarChar, codigo_unidade)
            .query('DELETE FROM ProfessorUnidade WHERE id_professor = @id_professor AND codigo_unidade = @codigo_unidade');

        res.sendStatus(200); // Resposta de sucesso
    } catch (error) {
        console.error('Erro ao desassociar professor:', error);
        res.status(500).send('Erro ao desassociar professor.');
    }
});



// Rota para excluir um tipo de aula
router.delete('/excluir-tipo-aula/:idTipoAula', async (req, res) => {
    const { idTipoAula } = req.params;

    try {
        // Verifica se há referências a este tipo de aula
        const referenceCheck = await pool.request()
            .input('idTipoAula', sql.Int, idTipoAula)
            .query('SELECT COUNT(*) AS count FROM unidade_tipo_aula WHERE id_tipo_aula = @idTipoAula');

        if (referenceCheck.recordset[0].count > 0) {
            return res.status(409).send('Não é possível excluir este tipo de aula; ele está associado a unidades.');
        }

        // Se não houver referências, procede com a exclusão
        await pool.request()
            .input('idTipoAula', sql.Int, idTipoAula)
            .query('DELETE FROM tipos_aula WHERE id_tipo_aula = @idTipoAula');

        res.sendStatus(200);
    } catch (error) {
        console.error('Erro ao excluir tipo de aula:', error);
        res.status(500).send('Erro ao excluir tipo de aula.');
    }
});
// Rota para adicionar uma nova unidade curricular (CORRIGIDA E COMPLETA)
router.post('/adicionar-unidade-curricular', async (req, res) => {
    // IMPORTANTE: Adicionamos 'codigoUnidade' aqui.
 const { ano, semestre, turma, turno, modulo, tipoCurso, codigoUnidade } = req.body; 

    // Verificação essencial, pois a UC deve pertencer a uma Unidade SENAI.
    if (!codigoUnidade) {
        return res.status(400).send('O código da unidade é obrigatório.');
    }

        try {
        await pool.request()
        .input('ano', sql.Int, ano)
        .input('semestre', sql.Int, semestre)
        .input('turma', sql.NVarChar(1), turma)
        .input('turno', sql.Int, turno)
        .input('modulo', sql.Int, modulo)
        .input('tipoCurso', sql.Int, tipoCurso)
                    .input('codigoUnidade', sql.NVarChar, codigoUnidade) // NOVO INPUT
        .query(`
        INSERT INTO UnidadesCurriculares (ano, semestre, turma, turno, modulo, tipo_curso, codigo_unidade)
        VALUES (@ano, @semestre, @turma, @turno, @modulo, @tipoCurso, @codigoUnidade);
        `);

        res.status(201).send('Unidade curricular adicionada com sucesso!');
        } catch (error) {
        console.error('Erro ao adicionar unidade curricular:', error);
        res.status(500).send('Erro ao adicionar unidade curricular.');
        }
});
// Rota para listar Unidades Curriculares por código da Unidade SENAI (ROTA FALTANTE)
router.get('/listar-ucs-por-unidade/:codigoUnidade', async (req, res) => {
    const { codigoUnidade } = req.params;
    try {
        const result = await pool.request()
            .input('codigoUnidade', sql.NVarChar, codigoUnidade)
            .query(`
                SELECT id_unidade_curricular, ano, semestre, turma, turno, modulo, tipo_curso
                FROM UnidadesCurriculares
                WHERE codigo_unidade = @codigoUnidade
            `);
        
        // Se não houver registros, retorna um array vazio (status 200 OK) ou 404 (Not Found).
        // Vamos retornar 200 com array vazio para o frontend tratar a ausência de dados.
        if (result.recordset.length === 0) {
            return res.json([]);
        }

        res.json(result.recordset);
    } catch (err) {
        console.error('Erro ao listar UCs por unidade:', err);
        res.status(500).send('Erro ao listar Unidades Curriculares.');
    }
});

// Rota para associar uma unidade curricular a um tipo de aula (MELHORADA COM VERIFICAÇÃO)
router.post('/associar-unidade-tipo-aula', async (req, res) => {
    const { id_unidade_curricular, id_tipo_aula } = req.body;

    // 1. Validar inputs (para evitar falhas de conversão de tipo no SQL)
    if (!id_unidade_curricular || !id_tipo_aula) {
        return res.status(400).send('IDs de Unidade Curricular e Tipo de Aula são obrigatórios.');
    }

    try {
        // 2. VERIFICAÇÃO DE DUPLICIDADE (CHAVE PRIMÁRIA)
        const checkResult = await pool.request()
            .input('id_uc', sql.Int, id_unidade_curricular)
            .input('id_ta', sql.Int, id_tipo_aula)
            .query(`
                SELECT 1 
                FROM unidade_tipo_aula_associacao 
                WHERE id_unidade_curricular = @id_uc AND id_tipo_aula = @id_ta
            `);
        
        if (checkResult.recordset.length > 0) {
            return res.status(409).send('Esta associação já existe na matriz curricular.');
        }

        // 3. INSERÇÃO
        await pool.request()
            .input('id_uc', sql.Int, id_unidade_curricular)
            .input('id_ta', sql.Int, id_tipo_aula)
            .query(`
                INSERT INTO unidade_tipo_aula_associacao (id_unidade_curricular, id_tipo_aula)
                VALUES (@id_uc, @id_ta);
            `);

        res.status(201).send('Associação criada com sucesso!');
    } catch (error) {
        console.error('Erro crítico na associação:', error);
        res.status(500).send('Erro interno ao tentar associar.');
    }
});
// Rota para listar associações de uma unidade curricular
router.get('/listar-associacoes/:unidadeId', async (req, res) => {
    const { unidadeId } = req.params;

    try {
        const result = await pool.request()
            .input('unidadeId', sql.Int, unidadeId)
            .query(`
                SELECT uta.id_tipo_aula, ta.descricao
                FROM unidade_tipo_aula_associacao uta
                JOIN tipos_aula ta ON uta.id_tipo_aula = ta.id_tipo_aula
                WHERE uta.id_unidade_curricular = @unidadeId
            `);

        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao listar associações:', error);
        res.status(500).send('Erro ao listar associações.');
    }
});
// Rota para obter unidades curriculares
router.get('/listar-unidades-curriculares', async (req, res) => {
    try {
        const result = await pool.request().query('SELECT TOP (1000) [id_unidade_curricular], [ano], [semestre], [turma], [turno], [modulo], [tipo_curso] FROM [ProjetoSenai2.0].[dbo].[UnidadesCurriculares]');
        res.json(result.recordset);
    } catch (err) {
        console.error('Erro ao listar unidades curriculares:', err);
        res.status(500).send('Erro ao listar unidades curriculares.');
    }
});
        // Rota para dessassociar um ou mais tipos de aula de uma unidade curricular
router.delete('/dessassociar-unidade-tipo-aula', async (req, res) => {
        const { id_unidade_curricular, id_tipos_aula } = req.body;

        // ... (Verificação de array)

        try {
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        for (let id_tipo_aula of id_tipos_aula) {
        await transaction.request()
        .input('id_unidade_curricular', sql.Int, id_unidade_curricular)
        .input('id_tipo_aula', sql.Int, id_tipo_aula)
        .query(`
        DELETE FROM unidade_tipo_aula_associacao
        WHERE id_unidade_curricular = @id_unidade_curricular AND id_tipo_aula = @id_tipo_aula
        `); // <--- O DESTINO ESTÁ AQUI
        }

        await transaction.commit();
        res.status(200).send('Dessassociação realizada com sucesso!');
        } catch (error) {
        // ...
        }
 });


router.get('/verificar-agendamento/:id_sala/:data/:hora_inicio/:hora_fim', async (req, res) => {
    const { id_sala, data, hora_inicio, hora_fim } = req.params;

    // Validação das variáveis recebidas
    try {
        const result = await pool.request()
            .input('id_sala', sql.Int, id_sala)
            .input('data', sql.NVarChar, data)
            .input('hora_inicio', sql.NVarChar, hora_inicio)
            .input('hora_fim', sql.NVarChar, hora_fim)
            .query(`
                SELECT COUNT(*) AS numConflictos
                FROM agendamentos
                WHERE id_sala = @id_sala
                AND data_reservas = @data
                AND (
                    (hora_inicio < @hora_fim AND hora_fim > @hora_inicio)
                )
            `);

        const existe = result.recordset[0].numConflictos > 0;

        // Retorna resposta
        res.json({
            existe: existe,
            agendamentos: existe ? await getAgendamentos(id_sala, data, hora_inicio, hora_fim) : []
        });
    } catch (error) {
        console.error('Erro ao verificar agendamentos:', error);
        res.status(500).send('Erro ao verificar agendamentos.');
    }
});

// Função auxiliar para pegar os agendamentos em conflito
async function getAgendamentos(id_sala, data, hora_inicio, hora_fim) {
    const result = await pool.request()
        .input('id_sala', sql.Int, id_sala)
        .input('data', sql.NVarChar, data)
        .input('hora_inicio', sql.NVarChar, hora_inicio)
        .input('hora_fim', sql.NVarChar, hora_fim)
        .query(`
            SELECT a.*, p.nome AS nome_professor
            FROM agendamentos a
            JOIN professores p ON a.id_professor = p.id_professor
            WHERE a.id_sala = @id_sala AND a.data_reservas = @data
            AND (
                (a.hora_inicio < @hora_fim AND a.hora_fim > @hora_inicio)
            )
        `);

    return result.recordset;
}







// rota que lista o agendamento - tem q modificar algumas coisas
router.get('/listar-agendamentos/:id_Sala', async (req, res) => {
    const { id_Sala } = req.params;
    const hoje = new Date(); // Obtemos a data atual
    const dataAtual = hoje.toISOString().split('T')[0]; // Formato YYYY-MM-DD

    try {
        let result = await pool.request()
            .input('id_Sala', sql.Int, id_Sala)
            .input('dataAtual', sql.Date, dataAtual) // Adicionamos o parâmetro da data
            .query(`
                SELECT 
                    a.id_agendamento, 
                    a.data_reservas, 
                    a.hora_inicio, 
                    a.hora_fim, 
                    p.nome,
                    a.motivo,
                    a.tipo_aula
                FROM agendamentos a
                JOIN professores p ON a.id_professor = p.id_professor
                WHERE a.id_sala = @id_Sala
                  AND CAST(a.data_reservas AS DATE) = @dataAtual -- Filtra apenas agendamentos do dia atual
                ORDER BY a.hora_inicio; 
            `);
        
        if (result.recordset.length === 0) {
            // Retornar uma resposta que indica não haver agendamentos
            return res.status(204).send('Não há agendamentos para esta sala hoje.');
        }

        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao listar agendamentos:', error);
        res.status(500).send('Erro ao listar agendamentos.');
    }
});
// Rota para listar agendamentos do professor específico
router.get('/listar-agendamentos/:id_professor', async (req, res) => {
    console.log('Resposta do servidor:', await response.text()); 
    const { id_professor } = req.params;

    try {
        const result = await pool.request()
            .input('id_professor', sql.Int, id_professor)
            .query('SELECT * FROM agendamentos WHERE id_professor = @id_professor');

        if (result.recordset.length === 0) {
            return res.json([]); // Retorna um JSON vazio
        }

        res.json(result.recordset); // Retorna os dados em formato JSON
    } catch (error) {
        console.error('Erro ao listar agendamentos:', error);
        res.status(500).send('Erro ao listar agendamentos.');
    }
});
// Rota para listar agendamentos do professor logado
// Rota para listar agendamentos do professor logado
router.get('/listar-agendamentos-professor-logado', async (req, res) => {
    const id_professor = req.session.user?.id_professor;

    if (!id_professor) {
        return res.status(401).send('Usuário não autenticado.');
    }

    try {
        const result = await pool.request()
            .input('id_professor', sql.Int, id_professor)
            .query(`
                SELECT a.*, s.nome_sala 
                FROM agendamentos a 
                JOIN Salas s ON a.id_sala = s.id_sala 
                WHERE a.id_professor = @id_professor
            `);

        const agendamentos = result.recordset || [];
        res.json(agendamentos); // Retorna o JSON com os agendamentos do professor logado
    } catch (error) {
        console.error('Erro ao listar agendamentos do professor:', error);
        return res.status(500).send('Erro ao listar agendamentos do professor.');
    }
});



// exclui agenda
router.delete('/excluir-agendamento/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`Recebido pedido para excluir agendamento com ID: ${id}`);
    try {
        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM agendamentos WHERE id_agendamento = @id');
        res.sendStatus(200);
        console.log(`Agendamento com ID: ${id} excluído com sucesso.`);
    } catch (error) {
        console.error('Erro ao excluir agendamento:', error);
        res.status(500).send('Erro ao excluir agendamento.');
    }
});
// Rota para excluir agendamentos em um intervalo de datas para uma unidade específica
router.delete('/excluir-agendamentos-intervalo', async (req, res) => {
    const { codigoUnidade, dataInicio, dataFim } = req.body;

    try {
        await pool.request()
            .input('codigoUnidade', sql.NVarChar, codigoUnidade)
            .input('dataInicio', sql.Date, dataInicio)
            .input('dataFim', sql.Date, dataFim)
            .query(`
                DELETE FROM agendamentos 
                WHERE data_reservas BETWEEN @dataInicio AND @dataFim 
                AND id_sala IN (SELECT id_sala FROM Salas WHERE codigo_unidade = @codigoUnidade)
            `); // Aqui subconsulta para garantir que é da unidade correta

        res.sendStatus(200);
    } catch (error) {
        console.error('Erro ao excluir agendamentos no intervalo:', error);
        res.status(500).send('Erro ao excluir agendamentos.');
    }
});



// feito ok
// Rota para listar todos os agendamentos de uma unidade
router.get('/listar-agendamento/:unidadeCodigo', async (req, res) => {
    const { unidadeCodigo } = req.params;
    try {
        const result = await pool.request()
            .input('unidadeCodigo', sql.NVarChar, unidadeCodigo)
            .query(`
                SELECT a.id_agendamento, a.data_reservas, a.hora_inicio, a.hora_fim, s.nome_sala, p.nome, a.motivo, a.tipo_aula
                FROM agendamentos a
                JOIN salas s ON a.id_sala = s.id_sala
                JOIN professores p ON a.id_professor = p.id_professor
                WHERE s.codigo_unidade = @unidadeCodigo
                ORDER BY a.data_reservas, a.hora_inicio; -- Ordenar por data e hora
            `);
        
        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao listar agendamentos:', error);
        res.status(500).send('Erro ao listar agendamentos.');
    }
});


// Rota para listar agendamentos filtrados
router.get('/listar-agendamentos-filtrados', async (req, res) => {
    const { unidadeCodigo, professor, dataInicio, dataFim, sala } = req.query;
    try {
        // Cria a consulta SQL dinâmica
        let query = `
            SELECT a.id_agendamento, s.nome_sala, p.nome, a.data_reservas, a.hora_inicio, a.hora_fim, a.motivo, a.tipo_aula
            FROM agendamentos a
            JOIN salas s ON a.id_sala = s.id_sala
            JOIN professores p ON a.id_professor = p.id_professor
            WHERE s.codigo_unidade = @unidadeCodigo
        `;
        
        if (professor) {
            query += ` AND p.nome LIKE '%' + @professor + '%'`;
        }
        
        if (dataInicio) {
            query += ` AND a.data_reservas >= @dataInicio`;
        }

        if (dataFim) {
            query += ` AND a.data_reservas <= @dataFim`;
        }

        if (sala) {
            query += ` AND s.nome_sala LIKE '%' + @sala + '%'`;
        }
        
        // Executando a consulta
        const result = await pool.request()
            .input('unidadeCodigo', sql.NVarChar, unidadeCodigo)
            .input('professor', sql.NVarChar, professor || '')
            .input('dataInicio', sql.NVarChar, dataInicio || '')
            .input('dataFim', sql.NVarChar, dataFim || '')
            .input('sala', sql.NVarChar, sala || '')
            .query(query);
        
        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao listar agendamentos filtrados:', error);
        res.status(500).send('Erro ao listar agendamentos filtrados.');
    }
});


// Rota para buscar programas associados a uma sala esta feito ok
router.get('/programas/:idSala', async (req, res) => {
    const { idSala } = req.params;
    try {
        let result = await pool.request()
            .input('idSala', sql.Int, idSala)
            .query(`
                SELECT p.id_programa, p.nome_programa, p.versao 
                FROM Programas p 
                JOIN SalaPrograma sp ON p.id_programa = sp.id_programa 
                WHERE sp.id_sala = @idSala
            `);
        res.json(result.recordset);
    } catch (err) {
        console.error('Erro ao obter programas da sala:', err);
        res.status(500).send(err.message);
    }
});

// Rota para criar unidade e salas  feito
router.post('/criar-unidade-salas', async (req, res) => {
    const { nomeUnidade, codigoUnidade, salas } = req.body;

    try {
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            const queryUnidade = `
                INSERT INTO Unidades (nome_unidade, codigo_unidade)
                VALUES (@nomeUnidade, @codigoUnidade);
            `;
            await transaction.request()
                .input('nomeUnidade', sql.NVarChar, nomeUnidade)
                .input('codigoUnidade', sql.NVarChar, codigoUnidade)
                .query(queryUnidade);

            for (const nomeSala of salas) {
                const querySala = `
                    INSERT INTO Salas (nome_sala, codigo_unidade)
                    VALUES (@nomeSala, @codigoUnidade);
                `;
                await transaction.request()
                    .input('nomeSala', sql.NVarChar, nomeSala)
                    .input('codigoUnidade', sql.NVarChar, codigoUnidade)
                    .query(querySala);
            }

            await transaction.commit();
            res.status(200).send('Unidade e salas criadas com sucesso!');
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Erro ao criar unidade e salas:', error);
        res.status(500).send('Erro ao criar unidade e salas.');
    }
});
//criado uma rota para excluir a sala
router.delete('/deletar-sala/:idSala', async (req, res) => {
    const { idSala } = req.params;
    try {
        await pool.request()
            .input('idSala', sql.Int, idSala)
            .query('DELETE FROM Salas WHERE id_sala = @idSala');
        res.sendStatus(200);
    } catch (error) {
        console.error('Erro ao excluir sala:', error);
        res.status(500).send('Erro ao excluir sala.');
    }
});
// Rota para renomear uma sala
router.post('/renomear-sala', async (req, res) => {
    const { idSala, novoNomeSala } = req.body;

    if (!idSala || !novoNomeSala) {
        return res.status(400).send('ID da sala e novo nome da sala são obrigatórios.');
    }

    try {
        const query = `
            UPDATE Salas
            SET nome_sala = @novoNomeSala
            WHERE id_sala = @idSala
        `;

        const request = pool.request();
        request.input('idSala', sql.Int, idSala);
        request.input('novoNomeSala', sql.NVarChar, novoNomeSala);

        await request.query(query);
        res.sendStatus(200); // Resposta de sucesso
    } catch (error) {
        console.error('Erro ao renomear sala:', error);
        res.status(500).send('Erro ao renomear sala.');
    }
});

// Rota para alterar a sala
router.post('/alterarSala', upload.single('image'), async (req, res) => {
    const idSala = req.body.idSala;
    const cadeiras = req.body.cadeiras;
    const computadores = req.body.computadores;
    const quadroBranco = req.body.quadroBranco;
    const telaProjetor = req.body.telaProjetor;
    const tv = req.body.tv;
    const area = req.body.area;
    const projetor = req.body.projetor;
    const maquinario = req.body.maquinario;

    const imageFilePath = req.file ? `/imagens/${req.file.filename}` : null;

    try {
        let query = `
            UPDATE Salas
            SET cadeiras = @cadeiras,
                computadores = @computadores,
                quadro_branco = @quadroBranco,
                tela_projetor = @telaProjetor,
                tv = @tv,
                area = @area,
                projetor = @projetor,
                maquinario = @maquinario
        `;
        if (imageFilePath) {
            query += `, imagem = @imageFilePath `;
        }
        query += ` WHERE id_sala = @idSala`;

        const request = pool.request();
        request.input('idSala', sql.Int, idSala);
        request.input('cadeiras', sql.Int, cadeiras);
        request.input('computadores', sql.Int, computadores);
        request.input('quadroBranco', sql.NVarChar(100), quadroBranco);
        request.input('telaProjetor', sql.NVarChar(100), telaProjetor);
        request.input('tv', sql.NVarChar(100), tv);
        request.input('area', sql.NVarChar(100), area);
        request.input('projetor', sql.NVarChar(100), projetor);
        request.input('maquinario', sql.NVarChar(100), maquinario);
        if (imageFilePath) {
            request.input('imageFilePath', sql.NVarChar(255), imageFilePath);
        }

        await request.query(query);
        res.sendStatus(200);
    } catch (error) {
        console.error('Erro ao atualizar os dados da sala:', error);
        res.status(500).send('Erro ao alterar os dados da sala: ' + error.message);
    }
});



// rota que lida para nova sala a ser adicionada
router.post('/adicionar-sala', async (req, res) => {
    const { codigoUnidade, nomeSala } = req.body;
    try {
        await pool.request()
            .input('codigoUnidade', sql.NVarChar, codigoUnidade)
            .input('nomeSala', sql.NVarChar, nomeSala)
            .query('INSERT INTO Salas (nome_sala, codigo_unidade) VALUES (@nomeSala, @codigoUnidade)');
        res.sendStatus(200);
    } catch (error) {
        console.error('Erro ao adicionar sala:', error);
        res.status(500).send('Erro ao adicionar sala.');
    }
});

// Rota para listar unidades e salas esta feito
router.get('/listar-unidades-salas', async (req, res) => {
    try {
        const query = `
            SELECT u.nome_unidade AS nome, u.codigo_unidade AS codigo,
                   s.nome_sala AS sala
            FROM Unidades u
            LEFT JOIN Salas s ON u.codigo_unidade = s.codigo_unidade
            ORDER BY u.nome_unidade, s.nome_sala;
        `;
        const result = await pool.request().query(query);

        const unidadesSalas = [];
        let unidadeAtual = null;
        for (const row of result.recordset) {
            if (row.nome !== unidadeAtual) {
                unidadeAtual = row.nome;
                unidadesSalas.push({ nome: row.nome, codigo: row.codigo, salas: [] });
            }
            unidadesSalas[unidadesSalas.length - 1].salas.push(row.sala);
        }

        res.json(unidadesSalas);
    } catch (error) {
        console.error('Erro ao obter a lista de unidades e salas:', error);
        res.status(500).send('Erro ao obter a lista de unidades e salas.');
    }
});

// Rota para listar unidades esta feito
router.get('/listar-unidades', async (req, res) => {
    try {
        const result = await pool.request().query('SELECT codigo_unidade AS codigo, nome_unidade AS nome FROM Unidades');
        res.json(result.recordset);
    } catch (err) {
        console.error('Erro ao listar unidades:', err);
        res.status(500).send('Erro ao listar unidades');
    }
});

// Rota para renomear unidade feito ok
router.post('/renomear-unidade', async (req, res) => {
    const { codigoUnidade, novoNomeUnidade } = req.body;
    try {
        await pool.request()
            .input('codigoUnidade', sql.NVarChar, codigoUnidade)
            .input('novoNomeUnidade', sql.NVarChar, novoNomeUnidade)
            .query(`
                UPDATE Unidades
                SET nome_unidade = @novoNomeUnidade
                WHERE codigo_unidade = @codigoUnidade
            `);
        res.sendStatus(200);
    } catch (err) {
        console.error('Erro ao renomear unidade:', err);
        res.status(500).send('Erro ao renomear unidade');
    }
});

// Rota para remover unidade e suas salas associadas feito ok
router.post('/remover-unidade', async (req, res) => {
    const { codigoUnidade } = req.body;

    try {
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            await transaction.request()
                .input('codigoUnidade', sql.NVarChar, codigoUnidade)
                .query('DELETE FROM Salas WHERE codigo_unidade = @codigoUnidade');

            await transaction.request()
                .input('codigoUnidade', sql.NVarChar, codigoUnidade)
                .query('DELETE FROM Unidades WHERE codigo_unidade = @codigoUnidade');

            await transaction.commit();
            res.sendStatus(200);
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (err) {
        console.error('Erro ao remover unidade:', err);
        res.status(500).send('Erro ao remover unidade');
    }
});

// Rota para adicionar um novo programa feito ok
router.post('/adicionarPrograma', async (req, res) => {
    const { nomePrograma, versao } = req.body;
    try {
        const query = `
            INSERT INTO programas (nome_programa, versao)
            VALUES (@nomePrograma, @versao)
        `;
        await pool.request()
            .input('nomePrograma', sql.NVarChar(50), nomePrograma)
            .input('versao', sql.NVarChar(50), versao)
            .query(query);
        res.sendStatus(200);
    } catch (error) {
        console.error('Erro ao adicionar o programa:', error);
        res.status(500).send('Erro ao adicionar o programa.');
    }
});
// insere nova sala na unidade existente tem que arrumar este codigo |  status ok
router.post('form-adicionar-salas', async (req, res) =>{
    const {unidadeAdicionarSala,  novaSala} = req.body;

    try{
        //Inicio
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try{
            for(const nomeSala of novaSala){
                // inserir nova sala
                const querySala = `
                INSERT INTO SALAS (nome_sala)
                values (@novaSala, @codigoUnidade)`; 
                
                await transaction.request()
                .input('nomeSala', sql.NVarChar, nomeSala)
                .input('codigoUnidade', sql.NVarChar, unidadeAdicionarSala)
                .query(querySala);
            }
            
                // Comitar a transação
                await transaction.commit();
                res.status(200).send('Salas criadas com sucesso!');

        }catch (error) {
            // Desfazer a transação em caso de erro
            await transaction.rollback();
            throw error; // Rethrow para tratar no bloco de erro externo
        }   
    }catch (error) {
        console.error('Erro ao criar salas:', error);
        res.status(500).send('Erro ao criar salas.');

    }
});

// Rota para excluir programas selecionados feito ok
router.post('/excluirProgramas', async (req, res) => {
    const { programas } = req.body;
    if (!Array.isArray(programas) || programas.length === 0) {
        return res.status(400).send('Nenhum programa selecionado para exclusão');
    }
    try {
        const query = `DELETE FROM programas WHERE id_programa IN (${programas.map(programa => parseInt(programa, 10)).join(',')})`;
        await pool.request().query(query);
        res.sendStatus(200);
    } catch (error) {
        console.error('Erro ao excluir programas:', error);
        res.status(500).send('Erro ao excluir programas.');
    }
});

// Rota para obter a lista de programas adicionados feito ok
router.get('/programasAdicionados', async (req, res) => {
    try {
        const query = 'SELECT id_programa, nome_programa, versao FROM programas';
        const result = await pool.request().query(query);
        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao obter programas adicionados:', error);
        res.status(500).send('Erro ao obter programas adicionados.');
    }
});

// Rota para obter salas pelas unidades do professor logado
router.get('/salas', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('Usuário não autenticado.');
    }

    const unidades = req.session.user.unidades; // As unidades associadas ao usuário

    try {
        if (!unidades || unidades.length === 0) {
            return res.status(404).send('Nenhuma unidade associada encontrada para o usuário.');
        }

        // Criando placeholders e preparando a consulta
        const placeholders = unidades.map((_, i) => `@unidade${i}`).join(', ');
        const request = pool.request();

        // Adicionando cada parâmetro à consulta
        unidades.forEach((unidade, i) => {
            request.input(`unidade${i}`, sql.NVarChar, unidade);
        });

        const result = await request.query(`
            SELECT s.id_sala, s.nome_sala, u.nome_unidade, u.codigo_unidade 
            FROM Salas s 
            JOIN Unidades u ON s.codigo_unidade = u.codigo_unidade 
            WHERE u.codigo_unidade IN (${placeholders})
        `);

        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao buscar as salas:', error);
        res.status(500).send('Erro ao buscar as salas');
    }
});

// Rota para verificar salas disponíveis
router.get('/salas-disponiveis', async (req, res) => {
    const { data, hora_inicio, hora_fim, codigo_unidade } = req.query;

    // Validações de parâmetros
    if (!data || !hora_inicio || !hora_fim || !codigo_unidade) {
        return res.status(400).send('Todos os parâmetros de data, hora e unidade são obrigatórios.');
    }

    const datas = data.split(',').map(d => d.trim()); // Divide múltiplas datas

    try {
        const resultados = [];

        for(const dataSelecionada of datas) {
            const query = `
                SELECT s.id_sala, s.nome_sala,   
                       CASE 
                           WHEN a.data_reservas IS NULL THEN @dataSelecionada 
                           ELSE NULL 
                       END as data_disponivel
                FROM Salas s
                LEFT JOIN Agendamentos a ON s.id_sala = a.id_sala
                AND a.data_reservas = @dataSelecionada
                AND (
                    (a.hora_inicio < @hora_fim AND a.hora_fim > @hora_inicio)
                )
                WHERE s.codigo_unidade = @codigo_unidade
            `;

            const request = pool.request();
            request.input('hora_inicio', sql.NVarChar, hora_inicio);
            request.input('hora_fim', sql.NVarChar, hora_fim);
            request.input('codigo_unidade', sql.NVarChar, codigo_unidade);
            request.input('dataSelecionada', sql.NVarChar, dataSelecionada);

            const result = await request.query(query);
            // Adiciona as salas ao resultado
            result.recordset.forEach(sala => {
                let salaIndex = resultados.findIndex(r => r.id_sala === sala.id_sala);
                if(salaIndex === -1) {
                    sala.datas_disponiveis = (sala.data_disponivel) ? [sala.data_disponivel] : [];
                    resultados.push(sala);
                } else {
                    if(sala.data_disponivel) {
                        resultados[salaIndex].datas_disponiveis.push(sala.data_disponivel);
                    }
                }
            });
        }

        // Apenas retorna salas com datas disponíveis
        resultados.forEach(r => {
            r.datas_disponiveis = [...new Set(r.datas_disponiveis)]; // Remove duplicatas
        });

        // Gerar o retorno
        res.json({ salasDisponiveis: resultados.filter(sala => sala.datas_disponiveis.length > 0) });
    } catch (error) {
        console.error('Erro ao verificar salas disponíveis:', error);
        res.status(500).send('Erro ao verificar salas disponíveis.');
    }
});



// PUDER VERIFICAR ISSO e mesclar a busca feito ok
router.get('/listasSalas', async (req, res) => {
    try {
      const result = await sql.query`
        SELECT s.id_sala, s.nome_sala, u.nome_unidade, u.codigo_unidade 
        FROM Salas s 
        JOIN Unidades u ON s.codigo_unidade = u.codigo_unidade
      `;
      res.json(result.recordset);
    } catch (error) {
      console.error('Erro ao buscar as salas:', error);
      res.status(500).send('Erro ao buscar as salas');
    }
  });
  // Endpoint para buscar os programas feito ok
  router.get('/listaProgramas', async (req, res) => {
    try {
      const result = await sql.query`SELECT id_programa, nome_programa, versao FROM Programas`;
      res.json(result.recordset);
    } catch (error) {
      console.error('Erro ao buscar os programas:', error);
      res.status(500).send('Erro ao buscar os programas');
    }
  });

// Rota para buscar programas associados a uma sala feito ok
router.get('/programas-sala/:id_sala', async (req, res) => {
    const { id_sala } = req.params;
    try {
        const query = `SELECT p.id_programa, p.nome_programa, p.versao FROM Programas p JOIN SalaPrograma sp ON p.id_programa = sp.id_programa WHERE sp.id_sala = @id_sala`;
        const result = await pool.request().input('id_sala', sql.Int, id_sala).query(query);
        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao buscar programas associados à sala:', error);
        res.status(500).send('Erro ao buscar programas associados à sala');
    }
});

// Rota para associar sala e programa feito ok
router.post('/associar-sala-programa', async (req, res) => {
    const { sala, programas } = req.body;
    try {
        for (const programa of programas) {
            const query = `INSERT INTO SalaPrograma (id_sala, id_programa) VALUES (@sala, @programa)`;
            await pool.request().input('sala', sql.Int, sala).input('programa', sql.Int, programa).query(query);
        }
        res.sendStatus(200);
    } catch (error) {
        console.error('Erro ao associar sala e programa:', error);
        res.status(500).send('Erro ao associar sala e programa');
    }
});

// Rota para desassociar sala e programa feito ok
router.post('/desassociar-sala-programa', async (req, res) => {
    const { sala, programas } = req.body;
    try {
        for (const programa of programas) {
            const query = `DELETE FROM SalaPrograma WHERE id_sala = @sala AND id_programa = @programa`;
            await pool.request().input('sala', sql.Int, sala).input('programa', sql.Int, programa).query(query);
        }
        res.sendStatus(200);
    } catch (error) {
        console.error('Erro ao desassociar sala e programa:', error);
        res.status(500).send('Erro ao desassociar sala e programa');
    }
});

//rota prof
router.get('/listar-professores-por-unidade/:codigoUnidade', async (req, res) => {
    const { codigoUnidade } = req.params;

    try {
        const result = await pool.request()
            .input('codigo_unidade', sql.NVarChar, codigoUnidade)
            .query(`
                SELECT p.id_professor, p.nome, p.login, p.matricula
                FROM professores p
                JOIN ProfessorUnidade pu ON p.id_professor = pu.id_professor
                WHERE pu.codigo_unidade = @codigo_unidade
            `);
        
        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao listar professores por unidade:', error);
        res.status(500).send('Erro ao listar professores.');
    }
});
// esta rota mostra geranciar agendamnetos botao editar

// Rota para listar todos os professores
router.get('/listar-todos-professores', async (req, res) => {
    try {
        const result = await pool.request()
            .query('SELECT p.id_professor, p.nome, p.login, p.matricula FROM professores p');

        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao listar todos os professores:', error);
        res.status(500).send('Erro ao listar professores.');
    }
});
// Rota para listar todos os tipos de aula
router.get('/listar-todos-tipos-aula', async (req, res) => {
    try {
        const result = await pool.request()
            .query('SELECT ta.id_tipo_aula, ta.descricao FROM tipos_aula ta');

        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao listar todos os tipos de aula:', error);
        res.status(500).send('Erro ao listar tipos de aula.');
    }
});



router.get('/listar-salas/:unidadeCodigo', async (req, res) => {
    const { unidadeCodigo } = req.params;
    try {
        let result = await pool.request()
            .input('unidadeCodigo', unidadeCodigo)
            .query(`
                SELECT id_sala, nome_sala
                FROM salas
                WHERE codigo_unidade = @unidadeCodigo
            `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao listar salas:', error);
        res.status(500).send('Erro ao listar salas.');
    }
});
// Rota para criar um novo professor
/*
router.post('/adicionar-professor', async (req, res) => {
    const { nome, matricula, codigo_unidade } = req.body;
    try {
        
        const result = await pool.request()
            .input('matricula', sql.NVarChar(20), matricula)
            .input('codigo_unidade', sql.NVarChar(10), codigo_unidade)
            .query(`
                SELECT COUNT(*) AS count 
                FROM professores 
                WHERE matricula = @matricula AND codigo_unidade = @codigo_unidade
            `);

        if (result.recordset[0].count > 0) {
            return res.status(409).send('Matrícula já cadastrada nesta unidade.');
        }

        const query = `
            INSERT INTO professores (nome, matricula, codigo_unidade)
            VALUES (@nome, @matricula, @codigo_unidade)
        `;
        await pool.request()
            .input('nome', sql.NVarChar(100), nome)
            .input('matricula', sql.NVarChar(20), matricula)
            .input('codigo_unidade', sql.NVarChar(10), codigo_unidade)
            .query(query);

        res.status(201).send('Professor adicionado com sucesso!');
    } catch (error) {
        console.error('Erro ao adicionar professor:', error);
        res.status(500).send('Erro ao adicionar professor.');
    }
});

// Rota para listar professores por unidade
router.get('/listar-professores-por-unidade/:codigoUnidade', async (req, res) => {
    const { codigoUnidade } = req.params;
    try {
        const result = await pool.request()
            .input('codigoUnidade', sql.NVarChar, codigoUnidade)
            .query(`SELECT id_professor, nome, matricula FROM professores WHERE codigo_unidade = @codigoUnidade`);
        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao listar professores:', error);
        res.status(500).send('Erro ao listar professores.');
    }
});
*/
//rota para excluir cadastro e tbm ela remove a associação
router.delete('/excluir-professor/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Primeiro, remover associações na tabela ProfessorUnidade
        await pool.request()
            .input('id_professor', sql.Int, id)
            .query('DELETE FROM ProfessorUnidade WHERE id_professor = @id_professor');

        // Depois, excluir o professor da tabela professores
        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM professores WHERE id_professor = @id');

        res.sendStatus(200);
    } catch (error) {
        console.error('Erro ao excluir professor:', error.message); // Log mais claro
        res.status(500).send('Erro ao excluir professor.');
    }
});
//cadastra o monitor no banco de dados
router.post('/cadastrar-monitor', async (req, res) => {
    const { modelo, polegadas, numero_serie, patrimonio } = req.body;

    if (!modelo || !polegadas || !numero_serie || !patrimonio) {
        return res.status(400).send('Todos os campos são obrigatórios.');
    }

    try {
        // 1. *** VERIFICAÇÃO DE DUPLICIDADE (NOVO CÓDIGO) ***
        const checkResult = await pool.request()
            .input('numero_serie', sql.NVarChar, numero_serie)
            .input('patrimonio', sql.NVarChar, patrimonio)
            .query(`
                SELECT TOP 1 id 
                FROM monitores 
                WHERE numero_serie = @numero_serie OR patrimonio = @patrimonio
            `);

        if (checkResult.recordset.length > 0) {
            return res.status(409).send('Erro: Monitor com este Número de Série ou Patrimônio já está cadastrado.');
        }
        // 1. *** FIM DA VERIFICAÇÃO ***

        // 2. Se a verificação passou, procede com o INSERT
        await pool.request()
            .input('modelo', sql.NVarChar, modelo)
            .input('polegadas', sql.Int, polegadas)
            .input('numero_serie', sql.NVarChar, numero_serie)
            .input('patrimonio', sql.NVarChar, patrimonio)
            .input('data_registro', sql.DateTime, new Date())
            .query(`
                INSERT INTO monitores (modelo, polegadas, numero_serie, patrimonio, data_registro)
                VALUES (@modelo, @polegadas, @numero_serie, @patrimonio, @data_registro)
            `);

        res.status(201).send('Monitor cadastrado com sucesso!');
    } catch (error) {
        console.error('Erro ao cadastrar monitor:', error);
        res.status(500).send('Erro ao cadastrar monitor.');
    }
});
// Rota para editar os detalhes de um monitor
router.put('/editar-monitor/:id', async (req, res) => {
    const { id } = req.params;
    const { modelo, polegadas, numero_serie, patrimonio } = req.body;
    
    try {
        // Opcional: Adicione a verificação de duplicidade por patrimônio/série aqui
        // antes de atualizar, mas excluindo o próprio ID que está sendo editado.

        const query = `
            UPDATE monitores
            SET modelo = @modelo,
                polegadas = @polegadas,
                numero_serie = @numero_serie,
                patrimonio = @patrimonio
            WHERE id = @id
        `;

        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('modelo', sql.NVarChar, modelo)
            .input('polegadas', sql.Int, polegadas)
            .input('numero_serie', sql.NVarChar, numero_serie)
            .input('patrimonio', sql.NVarChar, patrimonio)
            .query(query);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).send('Monitor não encontrado.');
        }

        res.status(200).send('Monitor atualizado com sucesso.');
    } catch (error) {
        console.error('Erro ao editar monitor:', error);
        res.status(500).send('Erro ao editar monitor.');
    }
});
// Rota para exclusão permanente do monitor (com checagem de integridade)
router.delete('/excluir-monitor/:id', async (req, res) => {
    const { id } = req.params;
    const monitorId = parseInt(id, 10);

    if (isNaN(monitorId)) {
        return res.status(400).send('ID do monitor inválido.');
    }

    try {
        // 1. CHECAGEM DE REFERÊNCIA (MonitorSala)
        const checkAssociation = await pool.request()
            .input('id_monitor', sql.Int, monitorId)
            .query('SELECT COUNT(*) AS count FROM MonitorSala WHERE id_monitor = @id_monitor');

        if (checkAssociation.recordset[0].count > 0) {
            return res.status(409).send('O monitor não pode ser excluído permanentemente porque está ASSOCIADO a uma sala. Primeiro, remova-o da sala.');
        }

        // 2. EXCLUSÃO PERMANENTE
        const result = await pool.request()
            .input('id', sql.Int, monitorId)
            .query('DELETE FROM monitores WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).send('Monitor não encontrado para exclusão.');
        }

        res.sendStatus(200); // Sucesso
    } catch (error) {
        console.error('Erro ao excluir monitor:', error);
        res.status(500).send('Erro interno ao excluir monitor.');
    }
});
// Adicione isso ao seu arquivo de rotas/router.js
router.post('/associar-computador', async (req, res) => {
    const { salaId, computadorId, tipoSala } = req.body;

    if (!salaId || !computadorId || !tipoSala) {
        return res.status(400).send('ID da sala, ID do computador e tipo da sala são obrigatórios.');
    }

    try {
        let query;
        if (tipoSala === 'academico') {
            query = `
                INSERT INTO SalaComputadorAcademica (id_sala, id_computador)
                VALUES (@salaId, @computadorId);
            `;
        } else if (tipoSala === 'administrativa') {
            query = `
                INSERT INTO SalaComputadorAdministrativa (id_sala, id_computador)
                VALUES (@salaId, @computadorId);
            `;
        }

        await pool.request()
            .input('salaId', sql.Int, salaId)
            .input('computadorId', sql.Int, computadorId)
            .query(query);

        res.sendStatus(200);
    } catch (error) {
        console.error('Erro ao associar computador à sala:', error);
        res.status(500).send('Erro ao associar computador à sala.');
    }
});

// Adicione ao seu arquivo de rotas/router.js
router.get('/computadores-associados/:id_sala/:tipoSala', async (req, res) => {
    const { id_sala, tipoSala } = req.params;

    try {
        let query;
        if (tipoSala === 'academico') {
            query = `
                SELECT
                    c.id as id_computador,
                    c.nome_computador,
                    c.SerialNumber,
                    c.endereco_mac,
                    c.cpu_info,
                    c.endereco_ip,
                    c.disco_info,
                    c.patrimonio,
                    c.data_registro
                FROM SalaComputadorAcademica sc
                JOIN computadores c ON sc.id_computador = c.id
                WHERE sc.id_sala = @id_sala
            `;
        } else if (tipoSala === 'administrativa') {
            query = `
                SELECT
                    c.id as id_computador,
                    c.nome_computador,
                    c.SerialNumber,
                    c.endereco_mac,
                    c.cpu_info,
                    c.endereco_ip,
                    c.disco_info,
                    c.patrimonio,
                    c.data_registro
                FROM SalaComputadorAdministrativa sc
                JOIN computadores c ON sc.id_computador = c.id
                WHERE sc.id_sala = @id_sala
            `;
        } else {
            return res.status(400).send('Tipo de sala inválido.');
        }

        const result = await pool.request()
            .input('id_sala', sql.Int, id_sala)
            .query(query);

        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao obter computadores associados à sala:', error);
        res.status(500).send('Erro ao obter computadores associados à sala.');
    }
});


// Rota para obter a lista de computadores
router.get('/infocomputadores', async (req, res) => {
    try {
        // Conectar ao banco de dados e realizar a consulta
        const pool = await sql.connect(config);
        const result = await pool.request().query(`
            SELECT TOP (1000) [id], 
                               [nome_computador],
                               [SerialNumber],
                               [endereco_mac], 
                               [patrimonio], 
                               [data_registro], 
                               [nomes_programas], 
                               [cpu_info], 
                               [endereco_ip],
                               [last_logged_user],
                               [network_adapters_details],
                               [disco_info] 
            FROM [ProjetoSenai2.0].[dbo].[computadores]
        `);

        // Retornar os dados em formato JSON
        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao buscar dados dos computadores:', error);
        res.status(500).send('Erro ao buscar dados dos computadores.');
    }
});
//esta rota desassocia computdores
router.delete('/desassociar-computador/:id_computador/:id_sala/:tipoSala', async (req, res) => {
    const { id_computador, id_sala, tipoSala } = req.params;
    try {
        let query;
        if (tipoSala === 'academico') {
            query = 'DELETE FROM SalaComputadorAcademica WHERE id_computador = @id_computador AND id_sala = @id_sala';
        } else if (tipoSala === 'administrativa') {
            query = 'DELETE FROM SalaComputadorAdministrativa WHERE id_computador = @id_computador AND id_sala = @id_sala';
        } else {
            return res.status(400).send('Tipo de sala inválido.');
        }
        await pool.request()
        .input('id_computador', sql.Int, id_computador)
        .input('id_sala', sql.Int, id_sala)
        .query(query);
        res.sendStatus(200);
    } catch (error) {
        console.error('Erro ao desassociar computador:', error);
        res.status(500).send('Erro ao desassociar computador.');
    }
});
// Rota para obter a lista de monitores e a sala associada (se houver)
router.get('/monitores', async (req, res) => {
    try {
        // ... (Seu código original aqui, está correto)
        const pool = await sql.connect(config);
        const result = await pool.request().query(`
             SELECT 
                 m.id,
                 m.modelo,
                 m.polegadas,
                 m.numero_serie,
                 m.patrimonio,
                 m.data_registro,
                 ms.id_sala
             FROM monitores m
             LEFT JOIN MonitorSala ms ON m.id = ms.id_monitor;
         `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao buscar dados dos monitores:', error);
        res.status(500).send('Erro ao buscar dados dos monitores.');
    }
});
// Rota para obter todas as salas acadêmicas (Tabela: Salas) - ROTA FALTANTE
router.get('/todas-salas-academicas', async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT id_sala, nome_sala 
            FROM Salas
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao buscar todas as salas acadêmicas:', error);
        res.status(500).send('Erro ao buscar todas as salas acadêmicas.');
    }
});
// Rota para obter todas as salas administrativas (Tabela: SalasAdministrativas) - ROTA FALTANTE
router.get('/todas-salas-administrativas', async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT id_sala, nome_sala 
            FROM SalasAdministrativas
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao buscar todas as salas administrativas:', error);
        res.status(500).send('Erro ao buscar todas as salas administrativas.');
    }
});
// Rota para obter TODOS os IDs de monitores já associados a qualquer sala - ROTA FALTANTE
router.get('/monitores-associados-all', async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT DISTINCT id_monitor 
            FROM MonitorSala
        `);
        // Retorna apenas uma lista simples de IDs (necessário para a lógica do JS)
        res.json(result.recordset.map(record => record.id_monitor)); 
    } catch (error) {
        console.error('Erro ao buscar todos os monitores associados (All):', error);
        res.status(500).send('Erro ao buscar todos os monitores associados (All).');
    }
});
// Rota para obter monitores associados
router.get('/monitores-associados/:id_sala', async (req, res) => {
    const { id_sala } = req.params;

    try {
        const result = await pool.request()
            .input('id_sala', sql.Int, id_sala)
            .query(`
                SELECT 
                    m.id, 
                    m.modelo, 
                    m.polegadas, 
                    m.patrimonio,
                    m.numero_serie  
                FROM MonitorSala ms
                JOIN monitores m ON ms.id_monitor = m.id
                WHERE ms.id_sala = @id_sala
            `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao buscar monitores associados:', error);
        res.status(500).send('Erro ao buscar monitores associados.');
    }
});

// Rota para remover a associação de um monitor com uma sala
router.delete('/desassociar-monitor/:monitorId/:salaId', async (req, res) => {
    const { monitorId, salaId } = req.params;

    try {
        await pool.request()
            .input('id_monitor', sql.Int, monitorId)
            .input('id_sala', sql.Int, salaId)
            .query(`
                DELETE FROM MonitorSala
                WHERE id_monitor = @id_monitor AND id_sala = @id_sala
            `);

        res.sendStatus(200);
    } catch (error) {
        console.error('Erro ao desassociar monitor da sala:', error);
        res.status(500).send('Erro ao desassociar monitor da sala.');
    }
});
// Rota para associar monitor - Rota original, está correta para ambos os tipos de sala
router.post('/associar-monitor', async (req, res) => {
    const { salaId, monitorId } = req.body;
    if (!salaId || !monitorId) {
        return res.status(400).send('ID da sala e do monitor são obrigatórios.');
    }
    try {
        await pool.request()
            .input('id_sala', sql.Int, salaId)
            .input('id_monitor', sql.Int, monitorId)
            .query(`
                INSERT INTO MonitorSala (id_sala, id_monitor)
                VALUES (@id_sala, @id_monitor)
            `);
        res.sendStatus(200);
    } catch (error) {
        // Se este erro 500 persistir, verifique a conexão (pool) e se há chave duplicada.
        console.error('Erro ao associar monitor à sala:', error);
        res.status(500).send('Erro ao associar monitor à sala.'); 
    }
});

// Rota para obter a lista de monitores e a sala associada (se houver)
router.get('/monitores', async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query(`
            SELECT 
                m.id,
                m.modelo,
                m.polegadas,
                m.numero_serie,
                m.patrimonio,
                m.data_registro,
                -- Faz um JOIN para obter o ID da sala, se existir
                ms.id_sala
            FROM monitores m
            LEFT JOIN MonitorSala ms ON m.id = ms.id_monitor;
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao buscar dados dos monitores:', error);
        res.status(500).send('Erro ao buscar dados dos monitores.');
    }
});

// Função para remover acentos
const removeAccents = (string) => {
    return string.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};


// routes/router.js (ou onde quer que tenha as rotas)

router.post('/api/chat', async (req, res) => {
    const { command } = req.body; // Supondo que o usuário vai enviar um comando indicando o que deseja

    try {
        let response; // Inicializa a variável de resposta

        if (command === 'getUnidades') {
            // Recupera as unidades disponíveis do banco de dados
            const unidades = await pool.request().query('SELECT codigo_unidade, nome_unidade FROM Unidades');
            response = unidades.recordset; // Armazena o resultado
        } else if (command === 'getSalas') {
            const { codigo_unidade } = req.body; // Esperando o código da unidade para buscar as salas
            const salas = await pool.request()
                .input('codigo_unidade', sql.NVarChar, codigo_unidade) // Passando a unidade como parâmetro
                .query('SELECT id_sala, nome_sala FROM Salas WHERE codigo_unidade = @codigo_unidade');

            response = salas.recordset; // Armazena o resultado
        } else {
            response = { message: 'Comando inválido!' }; // Mensagem de erro se o comando não for reconhecido
        }

        res.json(response); // Retorna a resposta como JSON
    } catch (error) {
        console.error('Erro ao processar a requisição:', error); // Log de erro
        res.status(500).json({ message: 'Erro ao processar a requisição' }); // Retorna erro
    }
});


// rota para o dashboard em construção
router.get('/horas-agendadas-mes', async (req, res) => {
    const id_professor = req.session.user?.id_professor;

    if (!id_professor) {
        return res.status(401).send('Usuário não autenticado.');
    }

    const inicioMes = moment().startOf('month').format('YYYY-MM-DD');
    const fimMes = moment().endOf('month').format('YYYY-MM-DD');

    try {
        const result = await pool.request()
            .input('id_professor', sql.Int, id_professor)
            .input('inicioMes', sql.NVarChar, inicioMes)
            .input('fimMes', sql.NVarChar, fimMes)
            .query(`
                SELECT hora_inicio, hora_fim, id_sala
                FROM agendamentos
                WHERE id_professor = @id_professor
                AND data_reservas BETWEEN @inicioMes AND @fimMes
            `);

        const agendamentos = result.recordset;
        const salasSet = new Set();
        let totalMinutos = 0;

        agendamentos.forEach(({ hora_inicio, hora_fim, id_sala }) => {
            const inicio = moment(hora_inicio, 'HH:mm');
            const fim = moment(hora_fim, 'HH:mm');
            const duracao = moment.duration(fim.diff(inicio));
            totalMinutos += duracao.asMinutes();
            salasSet.add(id_sala);
        });

        const horas = Math.floor(totalMinutos / 60);
        const minutos = Math.round(totalMinutos % 60);
        const quantidadeAgendamentos = agendamentos.length;
        const salasUtilizadas = salasSet.size;

        // Taxa de ocupação
        const diasDoMes = moment().daysInMonth();
        const horasPorDia = 14; // 08:00 às 22:00
        const salasDisponiveis = salasUtilizadas || 1; // evitar divisão por zero
        const horasTotaisDisponiveis = diasDoMes * horasPorDia * salasDisponiveis;
        const taxaOcupacao = ((horas + minutos / 60) / horasTotaisDisponiveis) * 100;

        res.json({
            horas,
            minutos,
            agendamentos: quantidadeAgendamentos,
            salas_utilizadas: salasUtilizadas,
            taxa_ocupacao: taxaOcupacao
        });
    } catch (error) {
        console.error('Erro ao calcular dados da dashboard:', error);
        res.status(500).send('Erro ao calcular dados da dashboard.');
    }
});
// rota para o dashboard mostrar semana agendamentos
router.get('/agenda-semanal-professor', async (req, res) => {
    const id_professor = req.session.user?.id_professor;
    if (!id_professor) return res.status(401).send('Não autenticado.');

    const hoje = moment();
    const inicioSemana = hoje.clone().startOf('week');
    const fimSemana = hoje.clone().endOf('week');

    try {
        const result = await pool.request()
            .input('id_professor', sql.Int, id_professor)
            .input('inicio', sql.NVarChar, inicioSemana.format('YYYY-MM-DD'))
            .input('fim', sql.NVarChar, fimSemana.format('YYYY-MM-DD'))
            .query(`
                SELECT data_reservas, hora_inicio, hora_fim, s.nome_sala
                FROM agendamentos a
                JOIN Salas s ON a.id_sala = s.id_sala
                WHERE a.id_professor = @id_professor
                AND data_reservas BETWEEN @inicio AND @fim
            `);

        const agenda = {};
        result.recordset.forEach(({ data_reservas, hora_inicio, hora_fim, nome_sala }) => {
            const dia = moment(data_reservas).format('dddd'); // Monday, Tuesday...
            if (!agenda[dia]) agenda[dia] = [];
            agenda[dia].push(`${hora_inicio} - ${hora_fim} (${nome_sala})`);
        });

        res.json(agenda);
    } catch (error) {
        console.error('Erro ao buscar agenda semanal:', error);
        res.status(500).send('Erro ao buscar agenda semanal.');
    }
});

// esta rota mostra top de salas mais agendadas no dashboard
router.get('/top-salas-professor', async (req, res) => {
    const id_professor = req.session.user?.id_professor;
    if (!id_professor) return res.status(401).send('Não autenticado.');

    const doisMesesAtras = moment().subtract(2, 'months').format('YYYY-MM-DD');

    try {
        const result = await pool.request()
            .input('id_professor', sql.Int, id_professor)
            .input('dataInicio', sql.NVarChar, doisMesesAtras)
            .query(`
                SELECT TOP 5 s.nome_sala, COUNT(*) AS quantidade
                FROM agendamentos a
                JOIN Salas s ON a.id_sala = s.id_sala
                WHERE a.id_professor = @id_professor
                AND a.data_reservas >= @dataInicio
                GROUP BY s.nome_sala
                ORDER BY quantidade DESC
            `);

        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao buscar top salas:', error);
        res.status(500).send('Erro ao buscar top salas.');
    }
});
// Rota para verificar os horários livres de um professor em um período
router.get('/professor-disponibilidade/:id_professor', async (req, res) => {
    const { id_professor } = req.params;
    const { dataInicio, dataFim, horaInicioJornada, horaFimJornada } = req.query;

    // 1. Validação inicial dos parâmetros
    if (!dataInicio || !dataFim || !horaInicioJornada || !horaFimJornada) {
        return res.status(400).send('Parâmetros de data (início/fim) e jornada (início/fim) são obrigatórios.');
    }

    // Validação de ID
    const id = parseInt(id_professor, 10);
    if (isNaN(id)) {
        return res.status(400).send('ID do professor inválido.');
    }

    try {
        // 2. Buscar TODOS os agendamentos do professor no período
        const agendamentosResult = await pool.request()
            .input('id_professor', sql.Int, id)
            .input('dataInicio', sql.NVarChar, dataInicio)
            .input('dataFim', sql.NVarChar, dataFim)
            .query(`
                SELECT data_reservas, hora_inicio, hora_fim
                FROM agendamentos
                WHERE id_professor = @id_professor
                AND data_reservas BETWEEN @dataInicio AND @dataFim
                ORDER BY data_reservas, hora_inicio
            `);
        
        const agendamentos = agendamentosResult.recordset;

        // 3. Gerar a lista de dias úteis no período
        const diasParaChecar = [];
        let diaAtual = moment(dataInicio);
        const diaFim = moment(dataFim);

        while (diaAtual.isSameOrBefore(diaFim)) {
            // Se for um dia útil (Ex: não inclui sábado e domingo - ajuste a lógica se necessário)
            // Se você precisa de checagem mais específica de dias de semana, adicione aqui.
            // Exemplo para ignorar sábados (6) e domingos (0):
            // if (diaAtual.day() !== 0 && diaAtual.day() !== 6) { 
            //     diasParaChecar.push(diaAtual.format('YYYY-MM-DD'));
            // }

            diasParaChecar.push(diaAtual.format('YYYY-MM-DD'));
            diaAtual.add(1, 'days');
        }

        // 4. Lógica de Cruzamento: Encontrar horários livres
        const disponibilidade = {};

        diasParaChecar.forEach(data => {
            const agendamentosNoDia = agendamentos.filter(a => a.data_reservas === data);
            
            // Assume-se que o professor está livre em toda a jornada por padrão
            let intervalosLivres = [{
                inicio: moment(horaInicioJornada, 'HH:mm'),
                fim: moment(horaFimJornada, 'HH:mm')
            }];

            agendamentosNoDia.forEach(agendamento => {
                const inicioReserva = moment(agendamento.hora_inicio, 'HH:mm');
                const fimReserva = moment(agendamento.hora_fim, 'HH:mm');
                
                let novosIntervalos = [];
                intervalosLivres.forEach(intervalo => {
                    
                    // 1. Reserva começa antes e termina depois do intervalo livre atual
                    if (inicioReserva.isSameOrBefore(intervalo.inicio) && fimReserva.isSameOrAfter(intervalo.fim)) {
                        // Ocupa o intervalo todo, não adiciona nada
                    } 
                    // 2. Reserva divide o intervalo (cria dois novos)
                    else if (inicioReserva.isAfter(intervalo.inicio) && fimReserva.isBefore(intervalo.fim)) {
                        // Intervalo 1: do início do livre até o início da reserva
                        novosIntervalos.push({ inicio: intervalo.inicio, fim: inicioReserva });
                        // Intervalo 2: do fim da reserva até o fim do livre
                        novosIntervalos.push({ inicio: fimReserva, fim: intervalo.fim });
                    }
                    // 3. Reserva corta o início do intervalo
                    else if (inicioReserva.isSameOrBefore(intervalo.inicio) && fimReserva.isBefore(intervalo.fim) && fimReserva.isAfter(intervalo.inicio)) {
                        // Novo intervalo: do fim da reserva até o fim do livre
                        novosIntervalos.push({ inicio: fimReserva, fim: intervalo.fim });
                    }
                    // 4. Reserva corta o fim do intervalo
                    else if (inicioReserva.isAfter(intervalo.inicio) && inicioReserva.isBefore(intervalo.fim) && fimReserva.isSameOrAfter(intervalo.fim)) {
                        // Novo intervalo: do início do livre até o início da reserva
                        novosIntervalos.push({ inicio: intervalo.inicio, fim: inicioReserva });
                    } 
                    // 5. Reserva não conflita (está fora do intervalo)
                    else {
                        novosIntervalos.push(intervalo);
                    }
                });
                // Filtra intervalos inválidos (duração zero ou negativa) e atualiza
                intervalosLivres = novosIntervalos.filter(i => i.fim.diff(i.inicio, 'minutes') > 0);
            });

            // 5. Formatar os resultados
            if (intervalosLivres.length > 0) {
                disponibilidade[data] = intervalosLivres.map(i => ({
                    inicio: i.inicio.format('HH:mm'),
                    fim: i.fim.format('HH:mm')
                }));
            }
        });

        res.json({
            id_professor: id,
            disponibilidade: disponibilidade
        });

    } catch (error) {
        console.error('Erro ao verificar disponibilidade do professor:', error);
        res.status(500).send('Erro ao verificar disponibilidade do professor.');
    }
});


// --- CONFIGURAÇÃO DA API GEMINI (CORRIGIDA) ---
const { GoogleGenerativeAI } = require("@google/generative-ai");

const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY) {
    console.error("ERRO CRÍTICO: A variável GOOGLE_API_KEY não foi carregada.");
}

const genAI = new GoogleGenerativeAI(API_KEY);

// Rota para o Chatbot (POST /chat) - CORRIGIDA E FUNCIONAL
router.post('/chat', async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Nenhuma mensagem fornecida.' });
    }

    try {
        // 1. Obter o modelo generativo
       // const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        // Linha de teste
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        // 2. Montar o prompt no formato correto
        const prompt = message;
        
        // 3. Chamar a API com o prompt
        const result = await model.generateContent(prompt);
        const response = result.response;
        
        // 4. Extrair o texto da resposta de forma segura
        const text = response.candidates[0].content.parts[0].text;

        res.json({ reply: text });

    } catch (error) {
        console.error("Erro CRÍTICO ao chamar API Gemini:", error);
        
        let errorMessage = 'Ocorreu um erro interno no Servidor de IA.';
        if (error.message) {
            errorMessage += ' Detalhe: ' + error.message;
        }

        res.status(500).json({ error: errorMessage });
    }
});

// Rota para obter a lista de computadores com status de conexão
router.get('/computadores/inventario', async (req, res) => {
    // A "ponte" que criamos no server.js nos dá acesso à variável aqui!
    const connectedAgents = req.connectedAgents; 

    try {
        // 1. Busca os computadores no banco de dados
        // A variável 'pool' já está disponível neste arquivo
        const result = await pool.request().query('SELECT SerialNumber as serialNumber, nome_computador as nomeComputador, network_adapters_details as ipAddress, last_logged_user as lastLoggedUser FROM computadores');

        const inventoryFromDb = result.recordset;

        // 2. Mapeia os dados do banco e adiciona o status de conexão em tempo real
        const inventoryWithStatus = inventoryFromDb.map(pc => ({
            ...pc, // Mantém todos os dados do PC
            isConnected: connectedAgents.has(pc.serialNumber) // Adiciona true ou false
        }));

        // 3. Envia a lista completa para o frontend
        res.json(inventoryWithStatus);

    } catch (error) {
        console.error('Erro ao buscar inventário com status:', error);
        res.status(500).send('Erro ao buscar dados do inventário.');
    }
});
// ==========================================================
// ROTAS DE RELATÓRIOS ATUALIZADAS (FILTRO ANUAL)
// ==========================================================

// ROTA 1: Relatório de Horas por Unidade Curricular (VERSÃO ANUAL)
router.get('/relatorio/horas-por-uc', async (req, res) => {
    const id_professor = req.session.user?.id_professor;
    if (!id_professor) return res.status(401).send('Não autenticado.');

    // ---> ADICIONADO: Pega o ano atual
    const anoAtual = new Date().getFullYear();

    try {
        const result = await pool.request()
            .input('id_professor', sql.Int, id_professor)
            // ---> ADICIONADO: Passa o ano para a consulta
            .input('anoAtual', sql.Int, anoAtual)
            .query(`
                SELECT 
                    tipo_aula, 
                    SUM(DATEDIFF(minute, hora_inicio, hora_fim)) AS total_minutos
                FROM agendamentos
                -- ---> ADICIONADO: Filtro por ano
                WHERE id_professor = @id_professor AND YEAR(data_reservas) = @anoAtual
                GROUP BY tipo_aula
                ORDER BY total_minutos DESC;
            `);
        
        const relatorioFormatado = result.recordset.map(item => ({
            tipo_aula: item.tipo_aula,
            horas: Math.floor(item.total_minutos / 60),
            minutos: item.total_minutos % 60
        }));
        res.json(relatorioFormatado);
    } catch (error) {
        console.error('Erro ao gerar relatório de horas por UC:', error);
        res.status(500).send('Erro ao gerar relatório.');
    }
});

// ROTA 2: Relatório de Uso de Salas (Detalhado) (VERSÃO ANUAL)
router.get('/relatorio/uso-salas', async (req, res) => {
    const id_professor = req.session.user?.id_professor;
    if (!id_professor) return res.status(401).send('Não autenticado.');

    // ---> ADICIONADO: Pega o ano atual
    const anoAtual = new Date().getFullYear();

    try {
        const result = await pool.request()
            .input('id_professor', sql.Int, id_professor)
            // ---> ADICIONADO: Passa o ano para a consulta
            .input('anoAtual', sql.Int, anoAtual)
            .query(`
                SELECT 
                    s.nome_sala, 
                    COUNT(a.id_agendamento) AS quantidade_usos,
                    SUM(DATEDIFF(minute, a.hora_inicio, a.hora_fim)) AS total_minutos
                FROM agendamentos a
                JOIN Salas s ON a.id_sala = s.id_sala
                -- ---> ADICIONADO: Filtro por ano
                WHERE a.id_professor = @id_professor AND YEAR(a.data_reservas) = @anoAtual
                GROUP BY s.nome_sala
                ORDER BY quantidade_usos DESC;
            `);

        const relatorioFormatado = result.recordset.map(item => ({
            nome_sala: item.nome_sala,
            quantidade_usos: item.quantidade_usos,
            horas: Math.floor(item.total_minutos / 60),
            minutos: item.total_minutos % 60
        }));
        res.json(relatorioFormatado);
    } catch (error) {
        console.error('Erro ao gerar relatório de uso de salas:', error);
        res.status(500).send('Erro ao gerar relatório.');
    }
});

// ROTA 3: Relatório de Agendamentos por Período (VERSÃO ANUAL)
router.get('/relatorio/agendamentos-periodo', async (req, res) => {
    const id_professor = req.session.user?.id_professor;
    if (!id_professor) return res.status(401).send('Não autenticado.');
    
    // ---> ADICIONADO: Pega o ano atual
    const anoAtual = new Date().getFullYear();

    try {
        const result = await pool.request()
            .input('id_professor', sql.Int, id_professor)
            // ---> ADICIONADO: Passa o ano para a consulta
            .input('anoAtual', sql.Int, anoAtual)
            .query(`
                SET LANGUAGE Brazilian; 
                SELECT 
                    DATENAME(weekday, data_reservas) AS dia_semana,
                    CASE 
                        WHEN CAST(hora_inicio AS TIME) < '12:00' THEN 'Manhã'
                        WHEN CAST(hora_inicio AS TIME) >= '12:00' AND CAST(hora_inicio AS TIME) < '18:00' THEN 'Tarde'
                        ELSE 'Noite'
                    END AS turno,
                    COUNT(id_agendamento) AS quantidade
                FROM agendamentos
                -- ---> ADICIONADO: Filtro por ano
                WHERE id_professor = @id_professor AND YEAR(data_reservas) = @anoAtual
                GROUP BY DATENAME(weekday, data_reservas), 
                         CASE 
                            WHEN CAST(hora_inicio AS TIME) < '12:00' THEN 'Manhã'
                            WHEN CAST(hora_inicio AS TIME) >= '12:00' AND CAST(hora_inicio AS TIME) < '18:00' THEN 'Tarde'
                            ELSE 'Noite'
                         END
                ORDER BY 
                    CASE DATENAME(weekday, data_reservas)
                        WHEN 'Domingo' THEN 1 WHEN 'Segunda-feira' THEN 2 WHEN 'Terça-feira' THEN 3
                        WHEN 'Quarta-feira' THEN 4 WHEN 'Quinta-feira' THEN 5 WHEN 'Sexta-feira' THEN 6
                        WHEN 'Sábado' THEN 7
                    END;
            `);
        
        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao gerar relatório por período:', error);
        res.status(500).send('Erro ao gerar relatório.');
    }
});
// Rota para dados do gráfico de Donut de uso de salas pelo professor
router.get('/relatorio/salas-porcentagem', async (req, res) => {
    const id_professor = req.session.user?.id_professor;
    if (!id_professor) return res.status(401).send('Não autenticado.');

    try {
        // Usamos a mesma lógica da sua barra de "top salas"
        const result = await pool.request()
            .input('id_professor', sql.Int, id_professor)
            .query(`
                SELECT TOP 5 -- Pegamos as 5 salas mais usadas para o gráfico não ficar poluído
                    s.nome_sala, 
                    COUNT(*) AS quantidade_usos
                FROM agendamentos a
                JOIN Salas s ON a.id_sala = s.id_sala
                WHERE a.id_professor = @id_professor
                GROUP BY s.nome_sala
                ORDER BY quantidade_usos DESC;
            `);

        // Formata os dados para o que a biblioteca de gráficos espera
        const labels = result.recordset.map(item => item.nome_sala);
        const data = result.recordset.map(item => item.quantidade_usos);

        res.json({ labels, data });

    } catch (error) {
        console.error('Erro ao gerar dados para o gráfico de salas:', error);
        res.status(500).send('Erro ao gerar dados do gráfico.');
    }
});
// Rota para obter detalhes de uma sala específica, incluindo contagem dinâmica de computadores
router.get('/salas/detalhes/:idSala', async (req, res) => {
    const { idSala } = req.params;
    
    try {
        const salaRequest = pool.request().input('idSala', sql.Int, idSala);
        
        // Query para os detalhes da sala (cadeiras, projetor, etc.)
        const detalhesResult = await salaRequest.query('SELECT * FROM Salas WHERE id_sala = @idSala');
        
        // MUDANÇA: Query para CONTAR os computadores associados dinamicamente
        const contagemPcResult = await salaRequest.query('SELECT COUNT(id_computador) AS total_pcs FROM SalaComputadorAcademica WHERE id_sala = @idSala');
        
        // Query para os agendamentos da sala (para o futuro calendário)
        const agendamentosResult = await salaRequest.query(`
            SELECT a.motivo, a.data_reservas, a.hora_inicio, a.hora_fim, p.nome as nome_professor
            FROM agendamentos a JOIN professores p ON a.id_professor = p.id_professor
            WHERE a.id_sala = @idSala ORDER BY a.data_reservas, a.hora_inicio;
        `);

        if (detalhesResult.recordset.length === 0) {
            return res.status(404).send('Sala não encontrada.');
        }

        const detalhesDaSala = detalhesResult.recordset[0];
        // Adiciona a contagem dinâmica ao objeto de detalhes
        detalhesDaSala.computadores_associados = contagemPcResult.recordset[0].total_pcs;

        res.json({
            detalhes: detalhesDaSala,
            agendamentos: agendamentosResult.recordset
        });

    } catch (error) {
        console.error('Erro ao buscar detalhes da sala:', error);
        res.status(500).send('Erro ao buscar detalhes da sala.');
    }
});

// rotas do agente para administração de usuarios temporario para os alunos
router.post('/computadores/:serial/senha-temporaria', async (req, res) => {
    const { serial } = req.params;
    const { username, password, durationMinutes } = req.body;

    const connectedAgents = req.connectedAgents;

    if (!connectedAgents) {
        return res.status(500).json({ error: 'connectedAgents não disponível na requisição.' });
    }

    if (!username || !password || !durationMinutes) {
        return res.status(400).json({ error: 'username, password e durationMinutes são obrigatórios.' });
    }

    const agentInfo = connectedAgents.get(serial);

    if (!agentInfo || !agentInfo.ws || agentInfo.ws.readyState !== 1) {
        return res.status(404).json({ error: 'Agente desconectado ou não encontrado.' });
    }

    const command = {
        type: 'admin_create_or_update_user',
        username,
        password,
        durationMinutes: parseInt(durationMinutes, 10)
    };

    agentInfo.ws.send(JSON.stringify(command));

    console.log(`[ADMIN] Enviado para ${serial}:`, command);
    return res.status(200).json({ message: 'Comando de criação/atualização enviado com sucesso.' });
});

router.post('/computadores/:serial/bloquear-usuario', async (req, res) => {
    const { serial } = req.params;
    const { username } = req.body;

    const connectedAgents = req.connectedAgents;

    if (!connectedAgents) {
        return res.status(500).json({ error: 'connectedAgents não disponível na requisição.' });
    }

    if (!username) {
        return res.status(400).json({ error: 'username é obrigatório.' });
    }

    const agentInfo = connectedAgents.get(serial);

    if (!agentInfo || !agentInfo.ws || agentInfo.ws.readyState !== 1) {
        return res.status(404).json({ error: 'Agente desconectado ou não encontrado.' });
    }

    const command = {
        type: 'admin_disable_user',
        username
    };

    agentInfo.ws.send(JSON.stringify(command));

    console.log(`[ADMIN] Enviado para ${serial}:`, command);
    return res.status(200).json({ message: 'Comando de bloqueio enviado com sucesso.' });
});

router.get('/computadores/:serial/status-usuario', async (req, res) => {
    const { serial } = req.params;
    const { username } = req.query;

    const connectedAgents = req.connectedAgents;

    if (!connectedAgents) {
        return res.status(500).json({ error: 'connectedAgents não disponível na requisição.' });
    }

    if (!username) {
        return res.status(400).json({ error: 'username é obrigatório.' });
    }

    const agentInfo = connectedAgents.get(serial);

    if (!agentInfo || !agentInfo.ws || agentInfo.ws.readyState !== 1) {
        return res.status(404).json({ error: 'Agente desconectado ou não encontrado.' });
    }

    const command = {
        type: 'admin_get_user_status',
        username
    };

    agentInfo.ws.send(JSON.stringify(command));

    console.log(`[ADMIN] Enviado para ${serial}:`, command);
    return res.status(200).json({ message: `Consulta enviada para o agente ${serial}.` });
});

module.exports = router;

