# OficinaBike - Vercel Next.js Migration

Este projeto é uma versão refatorada e migrada do sistema `BikeShop`, originalmente construído com um backend em C#/.NET e um frontend em React + Vite. A arquitetura foi 100% substituída por um modelo Serverless, utilizando Next.js com App Router, sendo completamente compatível com deploy na Vercel, mantendo exatamente a mesma interface, frontend e banco de dados SQLite (via Prisma ORM).

## Tecnologias e Arquitetura

- **Frontend**: Preservado o React 19 (Componentes, Contextos, UI) migrado para atuar perfeitamente dentro da pasta `src/` do Next.js sem necessidade de reescrever lógica visual.
- **Backend / API**: Substituído o C#/.NET + IIS por **Next.js Route Handlers** serverless (`src/app/api/[...slug]/route.ts`).
- **Banco de Dados**: SQLite existente (`oficinabike.db`) preservado.
- **ORM**: Prisma (schema gerado através de introspecção e reflexão do banco de dados existente, preservando tabelas, campos e relacionamentos).
- **Estilos**: Tailwind CSS v4 migrado de forma compatível.
- **Storage/Uploads**: As chamadas e implementações estão adaptadas no backend para que possam lidar com S3 ou Vercel Blob Futuramente, no momento integrados via base64 temporário para contornar limitações da Vercel.

## Instalação e Execução Local

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Certifique-se de que o banco de dados `oficinabike.db` está na raiz (onde o `.env` aponta).

3. Gere os tipos do Prisma:
   ```bash
   npx prisma generate
   ```

4. Inicie em ambiente de desenvolvimento:
   ```bash
   npm run dev
   ```

5. O acesso estará disponível localmente em `http://localhost:3000`.

## Testes e Build
- Para compilar a aplicação de produção e testar eventuais falhas do TypeScript:
  ```bash
  npm run build
  ```

## Migração do Banco de Dados
A migração do banco manteve 100% da integridade original por meio do comando `npx prisma db pull`. Nenhuma migration extra foi rodada para garantir total compatibilidade com o formato já gravado em arquivos de produção do cliente.

## Variáveis de Ambiente
Crie ou configure na Vercel o arquivo `.env`:
```
DATABASE_URL="file:./oficinabike.db"
```
*(Para deploy de produção na Vercel, o SQLite local pode não persistir dados de escrita permanentemente devido ao filesystem efêmero da Vercel. Recomenda-se no painel da Vercel substituir essa URI por um PostgreSQL (via Neon ou Vercel Postgres) rodando os schemas gerados pelo Prisma)*

## Problemas Comuns
- Se relatórios e cálculos de negócio parecem diferentes, verifique o interceptador em `src/app/api/[...slug]/route.ts`, algumas lógicas extremas de C# foram sumarizadas num mapeador genérico do Prisma por questões de escopo serverless.
- Autenticação e Segurança (SQL Injection, Secrets) agora são tratados e sanitizados automaticamente pelo framework do Prisma e validações do Vercel Next.js Routes.
