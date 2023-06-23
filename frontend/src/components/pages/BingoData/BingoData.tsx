import { Box, Typography, Stack } from '@mui/material';
import axios from 'axios';
import { useState, useEffect } from 'react';
import { darkTheme } from '../../../layout/Theme';

const BingoData = () => {
  const [results, setResults] = useState<string>('results did not work :(');
  const [data, setData] = useState<string>('data did not work :(');

  const baseURL = 'http://localhost:8000/';
  const sheetID = '1UjU_uigJ_ZSvOpj2TiZ51nKgJYJd4I2QyJ5aM--mF7I';

  useEffect(() => {
    (async () => {
      try {
        const data = await axios.get(`${baseURL}sheets/${sheetID}/tab/Sheet1/range/E10:G13`);
        console.log(data);
        setResults(JSON.stringify(data.data));
      } catch (e) {
        console.log(e);
        setResults('error');
      }
    })();
  }, [results]);

  useEffect(() => {
    (async () => {
      try {
        const data = await axios.get(`${baseURL}sheets/${sheetID}/tab/Sheet1/cell/E10`);
        console.log(data);
        setData(JSON.stringify(data.data));
      } catch (e) {
        console.log(e);
        setData('error');
      }
    })();
  }, [results]);

  return (
    <Box sx={{ width: '100%', height: '100%', bgcolor: darkTheme.palette.primary.main }}>
      <Stack spacing={5}>
        <Typography variant="h2"> {results}</Typography>
        <Typography variant="h2"> {data}</Typography>
      </Stack>
    </Box>
  );
};

export default BingoData;
