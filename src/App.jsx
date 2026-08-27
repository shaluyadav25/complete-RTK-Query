import Form from "./Form"

const App = () => {
  return (
    <main className="app-shell">
      <header className="page-header">
        <p className="eyebrow">Client directory</p>
        <h1>Create a profile</h1>
        <p className="intro">Add a contact and keep your directory in sync with the API.</p>
      </header>
      <Form />
    </main>
  )
}

export default App