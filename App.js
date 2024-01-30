import React, { useState, useEffect } from 'react';
import { ScrollView, StatusBar, View, TouchableOpacity } from 'react-native';
import { Button, Text, ListItem, Input, Overlay } from 'react-native-elements';
import * as FileSystem from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import { Asset } from 'expo-asset';




const App = () => {

  const [db, setDb] = useState(null); // Add state for the database instance
  const [previousResults, setPreviousResults] = useState([]);
  const [currentResult, setCurrentResult] = useState(null);
  const [isModalVisible, setModalVisible] = useState(false);
  const [correctionInput, setCorrectionInput] = useState('');
  const [selectedResultIndex, setSelectedResultIndex] = useState(null);

  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        const database = SQLite.openDatabase('results.db');
        setDb(database);
        await createTable(database);
        await loadPreviousResults(database);
      } catch (error) {
        console.error('Error initializing database:', error);
      }
    };

    initializeDatabase();
  }, []);
  const createTable = (database) => {
    database.transaction((tx) => {
      tx.executeSql(
        'CREATE TABLE IF NOT EXISTS results (id INTEGER PRIMARY KEY AUTOINCREMENT, value BOOLEAN)',
        [],
        (tx, results) => {
          console.log('Table created successfully');
        },
        (error) => {
          console.log('Error creating table:', error);
        }
      );
    });
  };


  const loadPreviousResults = (database) => {
    database.transaction((tx) => {
      tx.executeSql(
        'SELECT * FROM (SELECT * FROM results ORDER BY id DESC LIMIT 20) ORDER BY id ASC',
        [],
        (_, { rows: { _array } }) => {
          const tempResults = _array.map((item) => item.value);
          setPreviousResults(tempResults);
        },
        (_, error) => {
          console.error('Error loading previous results:', error);
        }
      );
    });
  };

  const saveResult = (result) => {
    db.transaction((tx) => {
      // Convert boolean result to 0 (false) or 1 (true)
      const booleanValue = result ? 1 : 0;

      tx.executeSql('INSERT INTO results (value) VALUES (?)', [booleanValue], (_, { insertId }) => {
        console.log('Result saved successfully with ID:', insertId);
      });
    });
  };

  const deleteResult = async (index) => {
    try {
      const idToDelete = await getLastInsertedRowId();
      db.transaction((tx) => {
        tx.executeSql(
          'DELETE FROM results WHERE id = ?',
          [idToDelete],
          (_, { rowsAffected }) => {
            if (rowsAffected > 0) {
              console.log('Result deleted successfully');
              const updatedResults = [...previousResults];
              updatedResults.splice(index, 1); // Remove the item at the specified index
              setPreviousResults(updatedResults);
            } else {
              console.log('No rows were deleted');
            }
          }
        );
      });
    } catch (error) {
      console.error('Error deleting result:', error);
    }
  };

  const getLastResult = () => {
    return new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          'SELECT * FROM results ORDER BY id DESC LIMIT 1',
          [],
          (_, { rows: { _array } }) => {
            if (_array.length > 0) {
              const lastResult = _array[0];
              resolve(lastResult);
            } else {
              // Handle the case when there are no results in the table
              resolve(null);
            }
          },
          (_, error) => {
            reject(error);
          }
        );
      });
    });
  };

  const updateResult = (id, value) => {
    db.transaction((tx) => {
      tx.executeSql('UPDATE results SET value = ? WHERE id = ?', [value, id], (_, { rowsAffected }) => {
        if (rowsAffected > 0) {
          console.log('Result updated successfully');
        } else {
          console.log('No rows were updated');
        }
      });
    });
  };



  const predictNextOutcome = () => {
    const prediction = Math.random() < 0.5;
    setCurrentResult(prediction);
    setPreviousResults((prevResults) => [...prevResults, prediction]);
    saveResult(prediction);
    setSelectedResultIndex(null);
  };

  const toggleModal = () => {
    setModalVisible(!isModalVisible);
  };

  const correctResult = async () => {
    if (correctionInput !== '' && selectedResultIndex !== null) {
      try {
        const lastResult = await getLastResult();
        console.log(lastResult);

        // Use lastResult.id or any other property as needed
        const lastInsertedId = lastResult.id;

        const correctedResult = correctionInput === 'B';
        const updatedResults = [...previousResults];
        updatedResults[selectedResultIndex] = correctedResult;
        setCurrentResult(correctedResult);
        setPreviousResults(updatedResults);
        updateResult(lastInsertedId, correctedResult);
        setCorrectionInput('');
        setSelectedResultIndex(null);
        toggleModal();
      } catch (error) {
        console.error('Error getting last result:', error);
      }
    }
  };

  const handleResultEdit = (index) => {
    setCorrectionInput(previousResults[index] ? 'B' : 'A');
    setSelectedResultIndex(index);
    toggleModal();
  };

  let count = 1

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <StatusBar hidden />
      <Text h3>النتائج السابقة</Text>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ width: '100%' }}>
          {previousResults.map((result, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleResultEdit(index)}
              onLongPress={() => deleteResult(index)}  // Added onLongPress event
            >
              <ListItem bottomDivider>
                <ListItem.Content>
                  <ListItem.Title>{count++}-{result ? 'B' : 'A'}</ListItem.Title>
                </ListItem.Content>
              </ListItem>
            </TouchableOpacity>
          ))}
        </View>
        <Text h3>النتيجة الحالية: {currentResult !== null ? (currentResult ? 'B' : 'A') : 'N/A'}</Text>
        <Button title="اضغط هنا للنتيجة التالية" type="solid" onPress={predictNextOutcome} buttonStyle={{ margin: 20 }} />
      </ScrollView>
      <Overlay isVisible={isModalVisible} onBackdropPress={toggleModal}>
        <View>
          <Text h4>تصحيح النتيجة</Text>
          <Input
            placeholder="أدخل النتيجة الصحيحة (B/A)"
            value={correctionInput}
            onChangeText={(text) => setCorrectionInput(text)}
          />
          <Button title="تأكيد" onPress={() => { correctResult() }} />
        </View>
      </Overlay>
    </View>
  );
};

export default App;
