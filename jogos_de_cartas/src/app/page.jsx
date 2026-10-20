'use client'

import { useRouter } from "next/navigation"
import { useState } from "react"

function getApiURL(){
  if(typeof window === 'undefined')
    return 'http://localhost:5000'

  const {hostname, origin} = window.location

  if(hostname === 'localhost' || hostname === '127.0.0.1')
    return 'http://localhost:5000'

  return origin.replace('-3000', '-5000')
}

export default function Home() {
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()

  async function handleSubmit(e){
    e.preventDefault()
    setError('')
    setSuccess('')

    const path = isRegister ? '/api/register' : '/api/login'

    const url = new URL(path, getApiURL()).href

    console.log('URL montada: ', url)
    
    const isLocalHost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

    const headers = {
      'Content-Type': 'application/json'
    }

    if(!isLocalHost){
      headers['bypass-tunnel-reminder'] = 'true'
      headers['X-Tunnel-Skip-Anti-Phising-Page'] = 'true'
    }

    try{
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({username, password})
      })

      const textResponse = await response.text()
      let data = {}
      try{
        data = JSON.parse(textResponse)
      } catch(err){
        console.log('A resposta do servidor não veio em formato JSON: ', textResponse)
      }

      if(!response.ok){
        setError(data.error || `Ocorreu um erro ao processar a requisição: ${response.status}: ${response.statusText}`)
        return;
      }

      if(isRegister){
        setSuccess('Conta criada com sucesso! Redirecionando para o login...')
        setTimeout(() => {
          setIsRegister(false)
          setSuccess('')
        }, 1500)
      }
      else{
        localStorage.setItem('playerId', data.user.id)
        localStorage.setItem('username', data.user.username)
        router.push('/rooms')
      }
    } catch(err){
      console.log('Erro na conexão: ', err)
      setError('Não foi possível conectar ao servidor.')
    }
  }
  
  return (
    <div className="background_div">
      <div className="main_div">
        <h1 className="titulo_login">{isRegister ? 'Criar Conta' : 'Entrar no Jogo'}</h1>

        <form onSubmit={handleSubmit} noValidate>
          <div>
            <label className="labels-login">Usuário:</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required/>
          </div>

          <div>
            <label className="labels-login">Senha:</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required/>
          </div>

          {error && <p className="error_message">{error}</p>}
          {success && <p className="success_message">{success}</p>}

          <button type="submit" className="button_submit">{isRegister ? <label className="labels-login tiraMargin">Cadastrar</label> : <label className="labels-login tiraMargin">Entrar</label>}</button>

          <div className="button_change">
            <button type="buttton" className="button_change_page" onClick={() => {
              setIsRegister(!isRegister)
              setError('')
              setSuccess('')
            }}>{isRegister ? <label className="labels-login tiraMargin">Já tem uma conta? Faça Login</label> : <label className="labels-login tiraMargin">Não tem conta? Cadastre-se</label>}</button>
          </div>
        </form>
      </div>
    </div>
  )
}