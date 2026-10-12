# Controle de Consulta — V1.0

Aplicativo desktop para Windows, com armazenamento local, destinado ao apoio administrativo da recepção de um consultório.

## Recursos
- Painel do dia e indicadores básicos.
- Cadastro, busca e edição de pacientes e médicos.
- Agenda de consultas e atualização de status.
- Fila de espera para consultas do dia.
- Registro de pagamentos e resumo financeiro.
- Relatórios mensais e exportação CSV com separador `;` e UTF-8.
- Login local, perfis de administrador, recepção e financeiro.
- Senhas armazenadas como hash scrypt com salt.
- Auditoria das ações principais.
- Exportação e restauração de backup JSON.
- Compilação automatizada de instalador `.exe` pelo GitHub Actions.

## Primeiro acesso
- Usuário: `admin`
- Senha inicial: `Trocar123!`

**Importante:** altere a senha inicial assim que possível. A senha `admin` é simples e serve apenas para o primeiro acesso/teste. Não compartilhe o arquivo de dados nem os backups.

## Compilar pelo GitHub (sem instalar programas no PC)
1. Crie um repositório novo no GitHub, por exemplo `Recepcao-Medica-Pro`.
2. Envie todos os arquivos e pastas deste ZIP, incluindo `.github/workflows/build-windows.yml`.
3. Abra a aba **Actions** no repositório.
4. Se necessário, habilite GitHub Actions.
5. Execute **Compilar aplicativo Windows** em **Run workflow**, ou faça um commit na branch `main`.
6. Quando terminar, abra a execução concluída e baixe o artefato `Controle-de-Consulta-Windows`.
7. Dentro do artefato estará o instalador `.exe`.

O GitHub Actions compila para Windows em uma máquina virtual hospedada pelo GitHub. O instalador é um artefato de teste; distribuição pública pode exigir assinatura de código para reduzir avisos do Windows.

## Armazenamento e backup
Os dados são salvos em um arquivo `recepcao-data.json` na pasta de dados do usuário criada pelo Electron (`app.getPath('userData')`). Esse arquivo fica fora da pasta do aplicativo e permanece após atualizações/desinstalação normal, salvo remoção manual dos dados do aplicativo.

Use **Configurações → Exportar backup** para guardar uma cópia em local seguro. Faça backup antes de restaurar.

## Segurança e limites importantes
- Esta V1.0 foi projetada para uso local em um único computador.
- O login e os perfis controlam o acesso dentro do aplicativo, mas não substituem uma conta Windows protegida, criptografia de disco, antivírus, controle físico do computador e backup seguro.
- Os dados locais e os backups JSON não são criptografados pelo aplicativo nesta versão. Proteja a conta Windows e a pasta de dados; não use dados reais sensíveis antes de validar a segurança e os requisitos legais aplicáveis.
- A auditoria registra ações administrativas, mas não é um log inviolável.
- As fichas desta versão são registros locais de apoio à recepção e à gestão de consultas. O sistema não substitui um prontuário eletrônico clínico validado e não oferece integração com sistemas clínicos, convênios ou assinatura digital.
- O perfil financeiro é restrito principalmente à área de pagamentos; permissões adicionais devem ser testadas antes do uso operacional.
- Antes de usar com pacientes reais, valide o funcionamento, faça cópias de segurança e solicite avaliação de segurança/privacidade, inclusive quanto à LGPD.

## Estrutura
```text
Controle-de-Consulta-v1.0/
├── .github/workflows/build-windows.yml
├── src/
│   ├── main.js
│   ├── preload.js
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── package.json
├── .gitignore
└── README.md
```
\n## Identidade visual e créditos\n- A imagem fornecida foi adicionada como `assets/logo.png` e `assets/arte-exemplo.png`.\n- O ícone Windows é `assets/app-icon.ico`, gerado a partir da imagem fornecida.\n- Créditos exibidos no aplicativo: **Daniel Marques via IA**.\n