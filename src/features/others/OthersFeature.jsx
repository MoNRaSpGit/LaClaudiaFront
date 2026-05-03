import { useState } from 'react';

function OthersFeature() {
  const [text, setText] = useState('');
  const [items, setItems] = useState([]);

  function handleSubmit(event) {
    event.preventDefault();
    const trimmedText = String(text || '').trim();
    if (!trimmedText) {
      return;
    }

    setItems((current) => [...current, trimmedText]);
    setText('');
  }

  return (
    <div className="container py-4">
      <div className="row justify-content-center">
        <div className="col-xl-8">
          <h1>Otros</h1>

          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <button type="submit">Agregar</button>
          </form>

          <div style={{ marginTop: '16px' }}>
            {items.map((item, index) => (
              <div key={`${item}-${index}`}>{item}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OthersFeature;
