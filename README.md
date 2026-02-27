# Sistema de Agendamento Acadêmico – Projeto SENAI 2.0

## Descrição
Sistema web desenvolvido para gerenciamento de **agendamento de aulas, salas, professores e infraestrutura**, com múltiplos perfis de usuário e regras reais de negócio.

O projeto foi desenvolvido de forma incremental, começando como um sistema simples e evoluindo para uma aplicação completa de gestão acadêmica, pensada para atender **mais de uma unidade**, de forma centralizada.

---

## Funcionalidades Principais

### Professor
- Login com controle de sessão
- Dashboard semanal com agendamentos
- Agendamento de aulas por sala, data e turno
- Visualização de todos os seus agendamentos
- Consulta de salas e informações detalhadas
- Relatório de aulas ministradas

### Coordenador / Administrador
- Dashboard administrativo
- Cadastro e gerenciamento de professores
- Alteração de agendamentos
- Alteração de dados das salas
- Gerenciamento de unidades curriculares
- Verificação de disponibilidade de professores
- Gerenciamento de programas
- Gerenciamento de equipamentos e infraestrutura
- Criação e gerenciamento de unidades (admin)

---

## Tecnologias Utilizadas

- **Frontend:** HTML5, CSS3, JavaScript puro
- **Backend:** Node.js, Express.js
- **Sessão e Autenticação:** express-session
- **Tempo e Datas:** Luxon
- **Agendamentos automáticos:** node-cron
- **Comunicação em tempo real:** WebSocket
- **Banco de Dados:** Relacional (SQL com queries parametrizadas)

---

## Diferenciais do Projeto

- Desenvolvido **sem frameworks frontend**
- Controle total do DOM e da lógica
- Regras reais de negócio
- Dashboards específicos por perfil
- Sistema funcional e escalável
- Arquitetura preparada para evolução
- Estrutura pensada para **múltiplas unidades**

---

## Status
✔ Funcional  
✔ Em evolução contínua  

---

## Nota Técnica (opcional)

### Funcionamento do Sistema
O sistema foi projetado para funcionar de forma **centralizada**, atendendo **todas as unidades** a partir de uma única aplicação.

- As unidades são cadastradas no banco de dados
- O usuário seleciona a unidade na página inicial
- Salas, agendas e relatórios são carregados conforme a unidade
- Um único servidor atende múltiplas unidades simultaneamente

---

### Arquitetura

- Frontend em JavaScript puro, com um JS por tela
- Backend em Node.js com Express
- Controle de sessão com `express-session`
- Comunicação em tempo real via WebSocket
- Execução de tarefas automáticas com `node-cron`
- Queries parametrizadas e uso de transações

---

### Instalação e Execução

#### Requisitos
- Node.js
- SQL Server
- PM2

#### Execução
- O backend é executado via Node.js
- O PM2 mantém o serviço ativo, reinicia em falhas e inicia junto ao servidor
- O banco centraliza os dados de todas as unidades

---

## Autor
**William Pereira do Nascimento**  
Projeto desenvolvido de forma individual no contexto acadêmico (SENAI)

Projeto Lean
