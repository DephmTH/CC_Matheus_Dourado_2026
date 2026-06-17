import os
import io
import datetime
import tempfile
import math
import numpy as np
import joblib
import jwt
from sklearn.neural_network import MLPClassifier

from pydantic import BaseModel
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from weasyprint import HTML

import models, schemas
from database import engine, SessionLocal

models.Base.metadata.create_all(bind=engine)
app = FastAPI(title="ERP Nacional API")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"]
)

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

# ==========================================
# SEGURANÇA E CRIPTOGRAFIA JWT (OAUTH2)
# ==========================================
SECRET_KEY = "PRO_VERSATIL_ERP_SUPER_SECRET_KEY_2026"
ALGORITHM = "HS256"
TOKEN_EXPIRATION_HOURS = 12

security = HTTPBearer()

def criar_token_jwt(data: dict):
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(hours=TOKEN_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    # Correção para blindar contra incompatibilidades da biblioteca PyJWT
    if isinstance(encoded_jwt, bytes):
        encoded_jwt = encoded_jwt.decode('utf-8')
    return encoded_jwt

def verificar_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        usuario: str = payload.get("sub")
        if usuario is None:
            raise HTTPException(status_code=401, detail="Credenciais inválidas")
        return usuario
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessão expirada. Faça login novamente.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido ou corrompido.")

class StatusUpdatePayload(BaseModel):
    novo_status: str

@app.get("/")
def home(): return {"status": "ERP Nacional Online - Engine Segura"}

@app.post("/api/login/")
def fazer_login(data: schemas.LoginData, request: Request, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "IP Desconhecido"
    
    if data.usuario == "admin" and data.senha == "erp_nacional":
        log = models.LogAcesso(usuario_tentativa=data.usuario, status="Sucesso (JWT Gerado)", ip_origem=ip)
        db.add(log); db.commit()
        
        token = criar_token_jwt({"sub": data.usuario})
        return {"status": "sucesso", "token": token}
    else:
        log = models.LogAcesso(usuario_tentativa=data.usuario, status="Falha (Senha Incorreta)", ip_origem=ip)
        db.add(log); db.commit()
        raise HTTPException(status_code=401, detail="Credenciais inválidas")

@app.get("/api/logs_acesso/", response_model=list[schemas.LogAcessoResponse])
def listar_logs_acesso(db: Session = Depends(get_db), token: str = Depends(verificar_token)):
    return db.query(models.LogAcesso).order_by(models.LogAcesso.data_hora.desc()).limit(50).all()

# ==========================================
# INTELIGÊNCIA ARTIFICIAL (REDE NEURAL)
# ==========================================
MODEL_FILE = "ia_credit_score.pkl"

def carregar_ou_treinar_ia():
    if os.path.exists(MODEL_FILE):
        return joblib.load(MODEL_FILE)
    else:
        X = np.array([
            [1, 5.0, 90],  [10, 10.0, 5], [2, 6.0, 45],  [5, 8.0, 15],  [0, 0.0, 100], [15, 11.5, 2]
        ])
        y = np.array([1, 0, 1, 0, 1, 0]) 
        clf = MLPClassifier(hidden_layer_sizes=(8, 4), activation='relu', solver='adam', max_iter=2000, random_state=42)
        clf.fit(X, y)
        joblib.dump(clf, MODEL_FILE)
        return clf

ia_model = carregar_ou_treinar_ia()

# ==========================================
# ROTAS BLINDADAS COM JWT (Depends(verificar_token))
# ==========================================
@app.get("/api/filiais/", response_model=list[schemas.FilialResponse])
def listar_filiais(db: Session = Depends(get_db), token: str = Depends(verificar_token)):
    filiais = db.query(models.Filial).all()
    if not filiais:
        matriz = models.Filial(nome="Matriz Sede", razao_social="SUA EMPRESA S/A", cnpj="00.000.000/0001-00", endereco="Av. Brasil, 100", telefone="(00) 0000-0000")
        db.add(matriz); db.commit(); db.refresh(matriz)
        filiais = [matriz]
    return filiais

@app.get("/api/matriz/", response_model=schemas.FilialResponse)
def obter_matriz(db: Session = Depends(get_db), token: str = Depends(verificar_token)):
    filial = db.query(models.Filial).first()
    if not filial:
        filial = models.Filial(nome="Matriz Sede", razao_social="SUA EMPRESA S/A", cnpj="00.000.000/0001-00", endereco="Av. Brasil, 100", telefone="(00) 0000-0000")
        db.add(filial); db.commit(); db.refresh(filial)
    return filial

@app.put("/api/matriz/", response_model=schemas.FilialResponse)
def atualizar_matriz(payload: schemas.FilialBase, db: Session = Depends(get_db), token: str = Depends(verificar_token)):
    try:
        filial = db.query(models.Filial).first()
        if not filial:
            filial = models.Filial(**payload.dict())
            db.add(filial)
        else:
            for key, value in payload.dict().items(): setattr(filial, key, value)
        db.commit(); db.refresh(filial)
        return filial
    except Exception as e:
        db.rollback(); raise HTTPException(status_code=400, detail=str(e))

def instanciar_formas_base(db: Session):
    if not db.query(models.FormaPagamento).first():
        basicas = ["Dinheiro", "Boleto Bancário", "Cartão de Crédito", "PIX"]
        for f in basicas: db.add(models.FormaPagamento(nome=f))
        db.commit()

@app.get("/api/formas_pagamento/", response_model=list[schemas.FormaPagamentoResponse])
def listar_formas_pagamento(db: Session = Depends(get_db), token: str = Depends(verificar_token)):
    instanciar_formas_base(db)
    return db.query(models.FormaPagamento).all()

@app.post("/api/formas_pagamento/", response_model=schemas.FormaPagamentoResponse)
def criar_forma_pagamento(payload: schemas.FormaPagamentoCreate, db: Session = Depends(get_db), token: str = Depends(verificar_token)):
    try:
        if db.query(models.FormaPagamento).filter(models.FormaPagamento.nome == payload.nome).first(): raise ValueError("Forma de pagamento já existe.")
        novo = models.FormaPagamento(**payload.dict())
        db.add(novo); db.commit(); db.refresh(novo)
        return novo
    except Exception as e:
        db.rollback(); raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/condicoes_pagamento/", response_model=list[schemas.CondicaoPagamentoResponse])
def listar_condicoes_pagamento(db: Session = Depends(get_db), token: str = Depends(verificar_token)):
    return db.query(models.CondicaoPagamento).all()

@app.post("/api/condicoes_pagamento/", response_model=schemas.CondicaoPagamentoResponse)
def criar_condicao_pagamento(payload: schemas.CondicaoPagamentoCreate, db: Session = Depends(get_db), token: str = Depends(verificar_token)):
    try:
        soma_perc = sum(p.percentual for p in payload.parcelas)
        if not (99.9 <= soma_perc <= 100.1): raise ValueError("A soma dos percentuais das parcelas deve ser 100%.")

        nova_condicao = models.CondicaoPagamento(descricao=payload.descricao, forma_pagamento_id=payload.forma_pagamento_id)
        db.add(nova_condicao); db.flush()

        for parcela in payload.parcelas:
            db.add(models.ParcelaCondicao(condicao_id=nova_condicao.id, numero_parcela=parcela.numero_parcela, dias_vencimento=parcela.dias_vencimento, percentual=parcela.percentual))
            
        db.commit(); db.refresh(nova_condicao)
        return nova_condicao
    except Exception as e:
        db.rollback(); raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/condicoes_pagamento/{id}")
def excluir_condicao(id: int, db: Session = Depends(get_db), token: str = Depends(verificar_token)):
    item = db.query(models.CondicaoPagamento).filter(models.CondicaoPagamento.id == id).first()
    if item: db.delete(item); db.commit()
    return {"status": "removido"}

@app.get("/api/produtos/", response_model=list[schemas.ProdutoResponse])
def listar_produtos(db: Session = Depends(get_db), token: str = Depends(verificar_token)): return db.query(models.Produto).all()

@app.post("/api/produtos/", response_model=schemas.ProdutoResponse)
def criar_produto(payload: schemas.ProdutoCreate, db: Session = Depends(get_db), token: str = Depends(verificar_token)):
    try:
        if db.query(models.Produto).filter(models.Produto.sku == payload.sku).first(): raise ValueError("SKU já cadastrado.")
        novo = models.Produto(**payload.dict()); db.add(novo); db.commit(); db.refresh(novo)
        return novo
    except Exception as e: db.rollback(); raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/produtos/{prod_id}", response_model=schemas.ProdutoResponse)
def atualizar_produto(prod_id: int, payload: schemas.ProdutoCreate, db: Session = Depends(get_db), token: str = Depends(verificar_token)):
    try:
        item = db.query(models.Produto).filter(models.Produto.id == prod_id).first()
        if not item: raise ValueError("Produto não encontrado")
        for key, value in payload.dict().items(): setattr(item, key, value)
        db.commit(); db.refresh(item)
        return item
    except Exception as e: db.rollback(); raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/produtos/{prod_id}")
def excluir_produto(prod_id: int, db: Session = Depends(get_db), token: str = Depends(verificar_token)):
    item = db.query(models.Produto).filter(models.Produto.id == prod_id).first()
    if item: db.delete(item); db.commit()
    return {"status": "removido"}

@app.get("/api/afiliados/", response_model=list[schemas.AfiliadoResponse])
def listar_afiliados(db: Session = Depends(get_db), token: str = Depends(verificar_token)): return db.query(models.Afiliado).all()

@app.post("/api/afiliados/", response_model=schemas.AfiliadoResponse)
def criar_afiliado(payload: schemas.AfiliadoCreate, db: Session = Depends(get_db), token: str = Depends(verificar_token)):
    try:
        novo = models.Afiliado(**payload.dict()); db.add(novo); db.commit(); db.refresh(novo)
        return novo
    except Exception as e: db.rollback(); raise HTTPException(status_code=400, detail="CNPJ duplicados.")

@app.put("/api/afiliados/{id}", response_model=schemas.AfiliadoResponse)
def atualizar_afiliado(id: int, payload: schemas.AfiliadoCreate, db: Session = Depends(get_db), token: str = Depends(verificar_token)):
    try:
        item = db.query(models.Afiliado).filter(models.Afiliado.id == id).first()
        if not item: raise ValueError("Afiliado não encontrado")
        for key, value in payload.dict().items(): setattr(item, key, value)
        db.commit(); db.refresh(item)
        return item
    except Exception as e: db.rollback(); raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/afiliados/{id}")
def excluir_afiliado(id: int, db: Session = Depends(get_db), token: str = Depends(verificar_token)):
    item = db.query(models.Afiliado).filter(models.Afiliado.id == id).first()
    if item: db.delete(item); db.commit()
    return {"status": "removido"}

@app.get("/api/transportadoras/", response_model=list[schemas.TransportadoraResponse])
def listar_transportadoras(db: Session = Depends(get_db), token: str = Depends(verificar_token)): return db.query(models.Transportadora).all()

@app.post("/api/transportadoras/", response_model=schemas.TransportadoraResponse)
def criar_transportadora(payload: schemas.TransportadoraCreate, db: Session = Depends(get_db), token: str = Depends(verificar_token)):
    try:
        novo = models.Transportadora(**payload.dict()); db.add(novo); db.commit(); db.refresh(novo)
        return novo
    except Exception as e: db.rollback(); raise HTTPException(status_code=400, detail="Erro ao inserir.")

@app.put("/api/transportadoras/{id}", response_model=schemas.TransportadoraResponse)
def atualizar_transportadora(id: int, payload: schemas.TransportadoraCreate, db: Session = Depends(get_db), token: str = Depends(verificar_token)):
    try:
        item = db.query(models.Transportadora).filter(models.Transportadora.id == id).first()
        if not item: raise ValueError("Não encontrado")
        for key, value in payload.dict().items(): setattr(item, key, value)
        db.commit(); db.refresh(item)
        return item
    except Exception as e: db.rollback(); raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/transportadoras/{id}")
def excluir_transportadora(id: int, db: Session = Depends(get_db), token: str = Depends(verificar_token)):
    item = db.query(models.Transportadora).filter(models.Transportadora.id == id).first()
    if item: db.delete(item); db.commit()
    return {"status": "removido"}

@app.get("/api/fornecedores/", response_model=list[schemas.FornecedorResponse])
def listar_fornecedores(db: Session = Depends(get_db), token: str = Depends(verificar_token)): return db.query(models.Fornecedor).all()

@app.post("/api/fornecedores/", response_model=schemas.FornecedorResponse)
def criar_fornecedor(payload: schemas.FornecedorCreate, db: Session = Depends(get_db), token: str = Depends(verificar_token)):
    try:
        novo = models.Fornecedor(**payload.dict()); db.add(novo); db.commit(); db.refresh(novo)
        return novo
    except Exception as e: db.rollback(); raise HTTPException(status_code=400, detail="CNPJ Duplicado.")

@app.put("/api/fornecedores/{id}", response_model=schemas.FornecedorResponse)
def atualizar_fornecedor(id: int, payload: schemas.FornecedorCreate, db: Session = Depends(get_db), token: str = Depends(verificar_token)):
    try:
        item = db.query(models.Fornecedor).filter(models.Fornecedor.id == id).first()
        if not item: raise ValueError("Não encontrado")
        for key, value in payload.dict().items(): setattr(item, key, value)
        db.commit(); db.refresh(item)
        return item
    except Exception as e: db.rollback(); raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/fornecedores/{id}")
def excluir_fornecedor(id: int, db: Session = Depends(get_db), token: str = Depends(verificar_token)):
    item = db.query(models.Fornecedor).filter(models.Fornecedor.id == id).first()
    if item: db.delete(item); db.commit()
    return {"status": "removido"}

@app.get("/api/clientes/")
def listar_clientes(db: Session = Depends(get_db), token: str = Depends(verificar_token)): return db.query(models.Cliente).all()

@app.post("/api/clientes/")
def criar_cliente(payload: schemas.ClienteCreate, db: Session = Depends(get_db), token: str = Depends(verificar_token)):
    try:
        existe = db.query(models.Cliente).filter(models.Cliente.documento == payload.documento).first()
        if existe: raise ValueError("Documento já cadastrado.")
        novo = models.Cliente(**payload.dict()); db.add(novo); db.commit(); db.refresh(novo)
        return novo
    except Exception as e: db.rollback(); raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/clientes/{id}")
def atualizar_cliente(id: int, payload: schemas.ClienteCreate, db: Session = Depends(get_db), token: str = Depends(verificar_token)):
    try:
        item = db.query(models.Cliente).filter(models.Cliente.id == id).first()
        if not item: raise ValueError("Cliente não encontrado")
        for key, value in payload.dict().items(): setattr(item, key, value)
        db.commit(); db.refresh(item)
        return item
    except Exception as e: db.rollback(); raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/funcionarios/")
def listar_funcionarios(db: Session = Depends(get_db), token: str = Depends(verificar_token)): return db.query(models.Funcionario).all()

@app.post("/api/funcionarios/", response_model=schemas.FuncionarioResponse)
def criar_funcionario(payload: schemas.FuncionarioCreate, db: Session = Depends(get_db), token: str = Depends(verificar_token)):
    try:
        filial = db.query(models.Filial).first()
        if not filial:
            filial = models.Filial(nome="Matriz Central", cidade_estado="Nacional")
            db.add(filial); db.commit(); db.refresh(filial)
            
        novo = models.Funcionario(
            nome=payload.nome, cargo=payload.cargo, salario_base=payload.salario_base, 
            filial_id=filial.id, afiliado_id=payload.afiliado_id
        )
        db.add(novo); db.commit(); db.refresh(novo)
        return novo
    except Exception as e: db.rollback(); raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/funcionarios/{id}", response_model=schemas.FuncionarioResponse)
def atualizar_funcionario(id: int, payload: schemas.FuncionarioCreate, db: Session = Depends(get_db), token: str = Depends(verificar_token)):
    try:
        item = db.query(models.Funcionario).filter(models.Funcionario.id == id).first()
        if not item: raise ValueError("Não encontrado")
        item.nome = payload.nome; item.cargo = payload.cargo; item.salario_base = payload.salario_base; item.afiliado_id = payload.afiliado_id
        db.commit(); db.refresh(item)
        return item
    except Exception as e: db.rollback(); raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/funcionarios/{id}")
def excluir_funcionario(id: int, db: Session = Depends(get_db), token: str = Depends(verificar_token)):
    item = db.query(models.Funcionario).filter(models.Funcionario.id == id).first()
    if item: db.delete(item); db.commit()
    return {"status": "removido"}

@app.post("/api/notas_fiscais/", response_model=schemas.NotaFiscalResponse)
def emitir_nota_fiscal(nf_data: schemas.NotaFiscalCreate, db: Session = Depends(get_db), token: str = Depends(verificar_token)):
    try:
        if db.query(models.NotaFiscal).filter(models.NotaFiscal.numero_nf == nf_data.numero_nf).first():
            raise ValueError("Nota Fiscal já existe no banco de dados.")

        valor_produtos_total = 0.0
        nova_nf = models.NotaFiscal(
            numero_nf=nf_data.numero_nf, 
            filial_id=nf_data.filial_id,
            emissor_afiliado_id=nf_data.emissor_afiliado_id,
            cliente_id=nf_data.cliente_id, 
            vendedor_id=nf_data.vendedor_id, 
            transportadora_id=nf_data.transportadora_id, 
            afiliado_id=nf_data.afiliado_id, 
            condicao_pagamento_id=nf_data.condicao_pagamento_id,
            valor_frete=nf_data.valor_frete
        )
        if nf_data.data_emissao: nova_nf.data_emissao = nf_data.data_emissao
            
        db.add(nova_nf); db.flush() 

        for item in nf_data.itens:
            produto = db.query(models.Produto).filter(models.Produto.id == item.produto_id).first()
            if not produto: raise ValueError("Produto não existe.")
            if produto.estoque_atual < item.quantidade: raise ValueError(f"Estoque insuficiente para {produto.nome}.")
            
            subtotal = produto.preco_venda * item.quantidade
            valor_produtos_total += subtotal
            produto.estoque_atual -= item.quantidade
            
            novo_item = models.NotaFiscalItem(nota_fiscal_id=nova_nf.id, produto_id=produto.id, quantidade=item.quantidade, preco_unitario=produto.preco_venda, subtotal=subtotal)
            db.add(novo_item)

        nova_nf.valor_produtos = valor_produtos_total
        nova_nf.valor_total = valor_produtos_total + nova_nf.valor_frete
        db.commit(); db.refresh(nova_nf)
        return nova_nf
    except Exception as e: db.rollback(); raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/notas_fiscais/", response_model=list[schemas.NotaFiscalResponse])
def listar_notas_fiscais(db: Session = Depends(get_db), token: str = Depends(verificar_token)): return db.query(models.NotaFiscal).all()

@app.put("/api/notas_fiscais/{nf_id}/status")
def atualizar_status_logistico(nf_id: int, payload: StatusUpdatePayload, db: Session = Depends(get_db), token: str = Depends(verificar_token)):
    try:
        nf = db.query(models.NotaFiscal).filter(models.NotaFiscal.id == nf_id).first()
        if not nf: raise ValueError("Nota Fiscal não encontrada")
        nf.status_logistico = payload.novo_status
        db.commit(); return {"status": "sucesso", "novo_status": nf.status_logistico}
    except Exception as e: db.rollback(); raise HTTPException(status_code=400, detail=str(e))

def fbr(valor):
    return f"{valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

@app.get("/api/notas_fiscais/{nf_id}/pdf")
def gerar_danfe_pdf(nf_id: int, db: Session = Depends(get_db)):
    try:
        nf_db = db.query(models.NotaFiscal).filter(models.NotaFiscal.id == nf_id).first()
        if not nf_db: raise HTTPException(status_code=404, detail="Nota Fiscal inexistente.")
        
        if nf_db.emissor_afiliado_id:
            emissor = db.query(models.Afiliado).get(nf_db.emissor_afiliado_id)
            matriz_razao = emissor.nome if emissor else "EMPRESA FILIADA"
            matriz_cnpj = emissor.cnpj if emissor else "00.000.000/0000-00"
            matriz_end = f"{emissor.cidade} - {emissor.pais}" if emissor else "Sede Filiada"
        else:
            matriz = db.query(models.Filial).filter(models.Filial.id == nf_db.filial_id).first()
            if not matriz: matriz = db.query(models.Filial).first()
            matriz_razao = matriz.razao_social if matriz else "SUA EMPRESA S/A"
            matriz_cnpj = matriz.cnpj if matriz else "00.000.000/0001-00"
            matriz_end = matriz.endereco if matriz else "Sede Administrativa"
        
        cliente = db.query(models.Cliente).get(nf_db.cliente_id)
        transportadora = db.query(models.Transportadora).get(nf_db.transportadora_id)
        
        nome_cli = cliente.nome if cliente else f"ID {nf_db.cliente_id}"
        doc_cli = cliente.documento if cliente else "-"
        end_cli = cliente.endereco if cliente else "-"
        nome_transp = transportadora.nome if transportadora else "Retirada Balcão"

        itens_rows = ""
        for idx, it in enumerate(nf_db.itens, 1):
            prod = db.query(models.Produto).get(it.produto_id)
            sku = prod.sku if prod else "SKU-N/A"
            desc = prod.nome if prod else "Item"
            itens_rows += f"<tr><td style='text-align:center;'>{idx:02d}</td><td>{sku}</td><td>{desc}</td><td style='text-align:center;'>{it.quantidade}</td><td style='text-align:right;'>R$ {fbr(it.preco_unitario)}</td><td style='text-align:right; font-weight:bold;'>R$ {fbr(it.subtotal)}</td></tr>"

        condicao = db.query(models.CondicaoPagamento).get(nf_db.condicao_pagamento_id)
        cond_desc = condicao.descricao if condicao else "À Vista"
        
        parcelas_html = ""
        if condicao and condicao.parcelas:
            for p in condicao.parcelas:
                venc = (nf_db.data_emissao + datetime.timedelta(days=p.dias_vencimento)).strftime('%d/%m/%Y')
                val = nf_db.valor_total * (p.percentual / 100.0)
                parcelas_html += f"<span style='margin-right:15px;'><strong>P{p.numero_parcela}:</strong> {venc} (R$ {fbr(val)})</span>"
        else:
            parcelas_html = f"<span><strong>Pagamento Único:</strong> R$ {fbr(nf_db.valor_total)}</span>"

        data_emissao_formatada = nf_db.data_emissao.strftime('%d/%m/%Y %H:%M')
        html_danfe = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                @page {{ size: A4; margin: 15mm 12mm; background-color: #ffffff; }}
                body {{ font-family: 'Arial', sans-serif; color: #1e293b; margin: 0; font-size: 11px; line-height: 1.4; }}
                .danfe-box {{ border: 2px solid #0f172a; padding: 15px; border-radius: 4px; }}
                .header-table {{ width: 100%; border-collapse: collapse; margin-bottom: 10px; }}
                .header-table td {{ border: 1px solid #0f172a; padding: 10px; vertical-align: top; }}
                .title {{ font-size: 16px; font-weight: bold; color: #0f172a; text-align: center; margin: 5px 0; }}
                .section-title {{ font-size: 10px; font-weight: bold; text-transform: uppercase; color: #475569; background: #f1f5f9; padding: 4px 8px; border: 1px solid #0f172a; border-bottom: none; margin-top: 15px; }}
                .info-table {{ width: 100%; border-collapse: collapse; border: 1px solid #0f172a; }}
                .info-table td {{ padding: 6px 8px; border: 1px solid #e2e8f0; }}
                .items-table {{ width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #0f172a; }}
                .items-table th {{ background: #0f172a; color: white; padding: 8px; font-size: 10px; text-transform: uppercase; border: 1px solid #0f172a; }}
                .items-table td {{ padding: 8px; border: 1px solid #cbd5e1; }}
                .total-box {{ float: right; width: 250px; margin-top: 15px; border: 1px solid #0f172a; background: #f8fafc; }}
                .total-box td {{ padding: 6px 10px; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="danfe-box">
                <table class="header-table">
                    <tr><td style="width:50%;"><strong style="font-size:14px;">{matriz_razao}</strong><br>Logística e Distribuição Comercial de Produtos<br>Emissor - CNPJ: {matriz_cnpj}<br>{matriz_end}</td><td style="width:50%; text-align:center; background:#f8fafc;"><div class="title">DOCUMENTO AUXILIAR DE NOTA FISCAL (DANFE)</div><span style="font-size:14px; font-weight:bold; color:#f97316;">Nº {nf_db.numero_nf}</span><br>Emissão: {data_emissao_formatada}</td></tr>
                </table>
                <div class="section-title">Destinatário / Remetente</div>
                <table class="info-table">
                    <tr><td style="width:70%;"><strong>Razão Social / Nome:</strong> {nome_cli}</td><td style="width:30%;"><strong>CNPJ / CPF:</strong> {doc_cli}</td></tr>
                    <tr><td colspan="2"><strong>Endereço de Despacho:</strong> {end_cli}</td></tr>
                </table>
                <div class="section-title">Dados Financeiros e Condições de Pagamento</div>
                <table class="info-table">
                    <tr><td style="background:#f8fafc;"><strong>Condição:</strong> {cond_desc}</td></tr>
                    <tr><td>{parcelas_html}</td></tr>
                </table>
                <div class="section-title">Dados de Transporte e Frete</div>
                <table class="info-table">
                    <tr><td style="width:50%;"><strong>Transportador Rodoviário:</strong> {nome_transp}</td><td style="width:50%;"><strong>Modalidade do Frete:</strong> Conta do Emitente (CIF)</td></tr>
                </table>
                <div class="section-title">Dados dos Produtos / Itens Faturados</div>
                <table class="items-table">
                    <thead><tr><th style="width:5%;">Seq</th><th style="width:15%;">SKU</th><th style="width:45%;">Descrição do Produto</th><th style="width:8%;">Qtd</th><th style="width:12%;">Preço Unit.</th><th style="width:15%;">Valor Total</th></tr></thead>
                    <tbody>{itens_rows}</tbody>
                </table>
                <table class="total-box">
                    <tr><td>Subtotal Itens:</td><td style="text-align:right;">R$ {fbr(nf_db.valor_produtos)}</td></tr>
                    <tr><td>Valor do Frete:</td><td style="text-align:right;">R$ {fbr(nf_db.valor_frete)}</td></tr>
                    <tr style="background:#0f172a; color:white; font-weight:bold;"><td>TOTAL DA NOTA:</td><td style="text-align:right; color:#10b981; font-size:14px;">R$ {fbr(nf_db.valor_total)}</td></tr>
                </table>
                <div style="clear:both;"></div>
            </div>
        </body>
        </html>
        """
        pdf_out = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
        HTML(string=html_danfe).write_pdf(pdf_out.name)
        return FileResponse(pdf_out.name, media_type='application/pdf', filename=f"DANFE_{nf_db.numero_nf}.pdf")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/relatorio/excel/{mes}")
def exportar_excel(mes: str, db: Session = Depends(get_db)):
    notas_todas = db.query(models.NotaFiscal).all()
    
    if mes != "geral" and "-" in mes:
        ano, m = mes.split("-")
        notas = [nf for nf in notas_todas if str(nf.data_emissao.year) == ano and str(nf.data_emissao.month).zfill(2) == m]
    else:
        notas = notas_todas

    html = "<html><head><meta charset='utf-8'></head><body><table border='1'>"
    html += "<tr><th style='background:#0f172a; color:white;'>Nota Fiscal</th><th style='background:#0f172a; color:white;'>Data Emissão</th><th style='background:#0f172a; color:white;'>Status</th><th style='background:#0f172a; color:white;'>Valor Produtos (R$)</th><th style='background:#0f172a; color:white;'>Frete (R$)</th><th style='background:#10b981; color:white;'>Total Faturado (R$)</th></tr>"
    
    for nf in notas:
        html += f"<tr><td>{nf.numero_nf}</td><td>{nf.data_emissao.strftime('%d/%m/%Y')}</td><td>{nf.status_logistico}</td><td>{nf.valor_produtos:.2f}</td><td>{nf.valor_frete:.2f}</td><td><strong style='color:#10b981;'>{nf.valor_total:.2f}</strong></td></tr>"
    
    html += "</table></body></html>"

    output = io.BytesIO(html.encode('utf-8'))
    return StreamingResponse(
        output,
        media_type="application/vnd.ms-excel",
        headers={"Content-Disposition": f"attachment; filename=Relatorio_Nacional_{mes}.xls"}
    )

@app.get("/api/dashboard/")
def obter_dados_dashboard(mes: str = "geral", db: Session = Depends(get_db), token: str = Depends(verificar_token)):
    notas_todas = db.query(models.NotaFiscal).all()
    clientes = db.query(models.Cliente).all()
    
    if mes != "geral" and "-" in mes:
        ano, m = mes.split("-")
        notas = [nf for nf in notas_todas if str(nf.data_emissao.year) == ano and str(nf.data_emissao.month).zfill(2) == m]
    else:
        notas = notas_todas
        
    faturamento_total = sum(nf.valor_produtos for nf in notas)
    custo_frete = sum(nf.valor_frete for nf in notas)
    comissoes = 0.0; vendas_afiliados = {}; vendas_filiais = {}

    dias_grafico = []; receita_diaria = []; frete_diario = []
    
    if mes == "geral":
        hoje = datetime.datetime.utcnow()
        for i in range(6, -1, -1):
            d = hoje - datetime.timedelta(days=i)
            d_str = d.strftime("%d/%m")
            dias_grafico.append(d_str)
            notas_do_dia = [nf for nf in notas if nf.data_emissao.strftime("%d/%m") == d_str]
            receita_diaria.append(sum(n.valor_produtos for n in notas_do_dia))
            frete_diario.append(sum(n.valor_frete for n in notas_do_dia))
    else:
        dias_com_venda = sorted(list(set(nf.data_emissao.strftime("%d/%m") for nf in notas)))
        dias_grafico = dias_com_venda[-7:] if len(dias_com_venda) > 7 else dias_com_venda
        if not dias_grafico:
            dias_grafico = ["Sem Dados"]
            receita_diaria = [0]
            frete_diario = [0]
        else:
            for d_str in dias_grafico:
                notas_do_dia = [nf for nf in notas if nf.data_emissao.strftime("%d/%m") == d_str]
                receita_diaria.append(sum(n.valor_produtos for n in notas_do_dia))
                frete_diario.append(sum(n.valor_frete for n in notas_do_dia))

    for nf in notas:
        if nf.afiliado_id:
            afil = db.query(models.Afiliado).get(nf.afiliado_id)
            if afil: comissoes += nf.valor_produtos * afil.taxa_comissao
            vendas_afiliados[nf.afiliado_id] = vendas_afiliados.get(nf.afiliado_id, 0) + 1
        
        if nf.emissor_afiliado_id:
            emissor = db.query(models.Afiliado).get(nf.emissor_afiliado_id)
            nome_filial = emissor.nome if emissor else "Filiada (Excluída)"
        elif nf.filial_id:
            matriz = db.query(models.Filial).get(nf.filial_id)
            nome_filial = matriz.nome if matriz else "Matriz Central"
        else:
            nome_filial = "E-commerce Direto"
            
        vendas_filiais[nome_filial] = vendas_filiais.get(nome_filial, 0) + nf.valor_total

    filiais_nomes = list(vendas_filiais.keys())
    filiais_vendas = list(vendas_filiais.values())
    if not filiais_nomes: filiais_nomes = ["Sem Vendas"]; filiais_vendas = [1]

    risco_total = 0.0; total_ativos = 0; radar_liquidez = 0; radar_historico = 0; radar_capacidade = 0
    for c in clientes:
        nfs_cliente = [nf for nf in notas if nf.cliente_id == c.id]
        if not nfs_cliente: continue
        nfs_cliente.sort(key=lambda x: x.data_emissao, reverse=True)
        
        f1_frequencia = len(nfs_cliente)
        f2_ltv_log = math.log1p(sum(nf.valor_total for nf in nfs_cliente))
        f3_recencia = (datetime.datetime.utcnow() - nfs_cliente[0].data_emissao).days
        
        features = np.array([[f1_frequencia, f2_ltv_log, f3_recencia]])
        prob_inadimplencia = ia_model.predict_proba(features)[0][1] 
        
        risco_total += prob_inadimplencia
        total_ativos += 1
        radar_liquidez += min(100, f2_ltv_log * 10)
        radar_historico += min(100, f1_frequencia * 20)
        radar_capacidade += max(0, 100 - f3_recencia)

    media_risco = (risco_total / total_ativos * 100) if total_ativos > 0 else 0.0
    if total_ativos > 0: radar_liquidez /= total_ativos; radar_historico /= total_ativos; radar_capacidade /= total_ativos

    top_afiliados = []
    for afil_id, qtd in sorted(vendas_afiliados.items(), key=lambda x: x[1], reverse=True)[:4]:
        afil_db = db.query(models.Afiliado).get(afil_id)
        if afil_db: top_afiliados.append({ "nome": afil_db.nome, "codigo": afil_db.codigo_rastreio, "vendas": qtd })

    return {
        "faturamentoTotal": faturamento_total, "custoFrete": custo_frete, "comissoes": comissoes, "totalPedidos": len(notas), "riscoInadimplencia": round(media_risco, 2),
        "metricasCredito": ["Liquidez Corrente", "Histórico de Pagto.", "Capacidade Operacional", "Risco de Mercado", "Score Neural IA"],
        "scoreMedio": [round(radar_liquidez), round(radar_historico), round(radar_capacidade), 65, max(0, 100 - round(media_risco))],
        "topAfiliados": top_afiliados, "dias": dias_grafico, "receitaDiaria": receita_diaria, "freteDiario": frete_diario,
        "filiaisNomes": filiais_nomes, "filiaisVendas": filiais_vendas
    }