from sqlalchemy import Column, Integer, String, Float, ForeignKey, Boolean, DateTime
from sqlalchemy.orm import relationship
import datetime
from database import Base

class Filial(Base):
    __tablename__ = "filiais"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, index=True)
    razao_social = Column(String, default="NEXORA GLOBAL S/A")
    cnpj = Column(String, default="00.000.000/0001-01")
    endereco = Column(String, default="Matriz Central Nacional")
    telefone = Column(String, default="(11) 1111-1111")
    cidade_estado = Column(String, default="Nacional")

class Fornecedor(Base):
    __tablename__ = "fornecedores"
    id = Column(Integer, primary_key=True, index=True)
    razao_social = Column(String, index=True)
    cnpj = Column(String, unique=True, index=True)
    contato = Column(String)

class Afiliado(Base):
    __tablename__ = "afiliados"
    id = Column(Integer, primary_key=True, index=True)
    cnpj = Column(String, unique=True, index=True)
    nome = Column(String, index=True) 
    pais = Column(String, default="Brasil")
    cidade = Column(String)
    codigo_rastreio = Column(String, unique=True, index=True)
    taxa_comissao = Column(Float, default=0.05)

class Transportadora(Base):
    __tablename__ = "transportadoras"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, index=True)
    cnpj = Column(String, unique=True, index=True)
    taxa_base_frete = Column(Float, default=0.0)

class Cliente(Base):
    __tablename__ = "clientes"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, index=True)
    documento = Column(String, unique=True, index=True)
    endereco = Column(String)
    telefone = Column(String, nullable=True)

class Funcionario(Base):
    __tablename__ = "funcionarios"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, index=True)
    cargo = Column(String, default="Vendedor")
    salario_base = Column(Float, default=0.0)
    ativo = Column(Boolean, default=True)
    filial_id = Column(Integer, ForeignKey("filiais.id"))
    afiliado_id = Column(Integer, ForeignKey("afiliados.id"), nullable=True)

class Produto(Base):
    __tablename__ = "produtos"
    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, unique=True, index=True)
    nome = Column(String, index=True)
    preco_custo = Column(Float)
    preco_venda = Column(Float)
    estoque_atual = Column(Integer, default=0)
    fornecedor_id = Column(Integer, ForeignKey("fornecedores.id"))

class FormaPagamento(Base):
    __tablename__ = "formas_pagamento"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, unique=True, index=True) 

class CondicaoPagamento(Base):
    __tablename__ = "condicoes_pagamento"
    id = Column(Integer, primary_key=True, index=True)
    descricao = Column(String)
    forma_pagamento_id = Column(Integer, ForeignKey("formas_pagamento.id"))
    forma_pagamento = relationship("FormaPagamento")
    parcelas = relationship("ParcelaCondicao", back_populates="condicao", cascade="all, delete-orphan")

class ParcelaCondicao(Base):
    __tablename__ = "parcelas_condicao"
    id = Column(Integer, primary_key=True, index=True)
    condicao_id = Column(Integer, ForeignKey("condicoes_pagamento.id"))
    numero_parcela = Column(Integer)
    dias_vencimento = Column(Integer) 
    percentual = Column(Float) 
    condicao = relationship("CondicaoPagamento", back_populates="parcelas")

class NotaFiscal(Base):
    __tablename__ = "notas_fiscais"
    id = Column(Integer, primary_key=True, index=True)
    numero_nf = Column(String, unique=True, index=True)
    data_emissao = Column(DateTime, default=datetime.datetime.utcnow)
    status_logistico = Column(String, default="Aprovada")
    valor_produtos = Column(Float, default=0.0)
    valor_frete = Column(Float, default=0.0)
    valor_total = Column(Float, default=0.0)
    
    filial_id = Column(Integer, ForeignKey("filiais.id"), nullable=True)
    emissor_afiliado_id = Column(Integer, ForeignKey("afiliados.id"), nullable=True)
    
    cliente_id = Column(Integer, ForeignKey("clientes.id"))
    vendedor_id = Column(Integer, ForeignKey("funcionarios.id"))
    afiliado_id = Column(Integer, ForeignKey("afiliados.id"), nullable=True) 
    transportadora_id = Column(Integer, ForeignKey("transportadoras.id"))
    condicao_pagamento_id = Column(Integer, ForeignKey("condicoes_pagamento.id"))
    
    itens = relationship("NotaFiscalItem", back_populates="nota")

class NotaFiscalItem(Base):
    __tablename__ = "nota_fiscal_itens"
    id = Column(Integer, primary_key=True, index=True)
    nota_fiscal_id = Column(Integer, ForeignKey("notas_fiscais.id"))
    produto_id = Column(Integer, ForeignKey("produtos.id"))
    quantidade = Column(Integer)
    preco_unitario = Column(Float)
    subtotal = Column(Float)
    nota = relationship("NotaFiscal", back_populates="itens")

# Tabela Exclusiva para Auditoria de Segurança
class LogAcesso(Base):
    __tablename__ = "logs_acesso"
    id = Column(Integer, primary_key=True, index=True)
    usuario_tentativa = Column(String, index=True)
    data_hora = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String) 
    ip_origem = Column(String)