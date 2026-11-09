import LoginForm from "./login-form";
export default function LoginPage(){return <main className="login"><section className="loginbox">
  <div className="eyebrow">CBE PERFORMANCE MANAGEMENT SYSTEM</div>
  <h1>Welcome back</h1><p className="muted">Sign in to access your school's assessment workspace.</p>
  <LoginForm/><p className="muted" style={{fontSize:11,marginTop:24}}>Secure school access · Administrator and Teacher accounts</p>
</section></main>}
