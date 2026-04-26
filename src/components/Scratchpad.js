import React, { useRef, useState } from 'react';

function Scratchpad({ commands, setCommands, sessionId, leftPaneWidth, ObjectUrlId }) {
  const executeCommand = (id) => {
    const proxy = window.terminalAPI || window.pluginAPI?.terminal;
    const cmd = commands.find(c => c.id === id);
    if (proxy && cmd && cmd.text.trim()) {
      proxy.input(sessionId, cmd.text + '\r');
    }
  };

  const handleKeyDown = (e, id) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executeCommand(id);
    }
  };

  const updateCommandText = (id, newText) => {
    setCommands(prev => prev.map(c => c.id === id ? { ...c, text: newText } : c));
  };

  const updateCommandTitle = (id, newTitle) => {
    setCommands(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
  };

  const addCommandBlock = () => {
    setCommands(prev => [...prev, { id: ObjectUrlId(), text: '' }]);
  };

  const removeCommandBlock = (id) => {
    setCommands(prev => prev.filter(c => c.id !== id));
  };

  const dragItem = useRef();
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const handleDragStart = (e, index) => {
    dragItem.current = index;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      e.preventDefault();
      return;
    }
    setTimeout(() => {
      e.target.style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnter = (e, index) => {
    setDragOverIndex(index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    
    if (dragItem.current != null && dragOverIndex != null && dragItem.current !== dragOverIndex) {
      setCommands(prev => {
        const newCommands = [...prev];
        const draggedCommand = newCommands[dragItem.current];
        
        if (!draggedCommand) return prev;
        
        newCommands.splice(dragItem.current, 1);
        newCommands.splice(dragOverIndex, 0, draggedCommand);
        return newCommands;
      });
    }
    dragItem.current = null;
    setDragOverIndex(null);
  };

  return (
    <div className="left-pane" style={{ width: `${leftPaneWidth}%`, flex: 'none' }}>
      <div className="scratchpad-header">
        <span>Command Scratchpad</span>
      </div>
      <div className="commands-list">
        {commands.map((cmd, index) => {
          let dragClass = '';
          if (dragOverIndex === index && dragItem.current != null && dragItem.current !== index) {
            if (dragItem.current > index) {
              dragClass = 'drag-over-top';
            } else {
              dragClass = 'drag-over-bottom';
            }
          }

          return (
          <div 
            key={cmd.id} 
            className={`command-block ${dragClass}`}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnter={(e) => handleDragEnter(e, index)}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            style={{ cursor: 'grab' }}
          >
            <div className="command-actions" style={{ cursor: 'default' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                  <i className="ri-drag-move-2-fill" style={{ color: '#9CA3AF', cursor: 'grab', fontSize: '14px' }} title="Drag to reorder"></i>
                  <input 
                    className="command-title-input command-number" 
                    value={cmd.title !== undefined ? cmd.title : ''} 
                    onChange={(e) => updateCommandTitle(cmd.id, e.target.value)}
                    placeholder={`CMD ${index + 1}`}
                    title="Rename command block"
                    spellCheck={false}
                  />
                </div>
                <div className="command-btn-group">
                  <button className="icon-btn" onClick={() => executeCommand(cmd.id)} title="Run">
                    <i className="ri-play-fill run-icon"></i>
                  </button>
                  <button className="icon-btn" onClick={() => removeCommandBlock(cmd.id)} title="Remove">
                    <i className="ri-delete-bin-line remove-icon"></i>
                  </button>
                </div>
            </div>
            <textarea
              className="scratchpad-textarea block-textarea"
              value={cmd.text}
              onChange={(e) => updateCommandText(cmd.id, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, cmd.id)}
              placeholder="Type shell command...&#10;Enter to run, Shift+Enter for newline."
              spellCheck={false}
            />
          </div>
        )})}
      </div>
      <button className="add-command-btn" onClick={addCommandBlock}>
        <i className="ri-add-line"></i> Add Command Block
      </button>
    </div>
  );
}

export default Scratchpad;
