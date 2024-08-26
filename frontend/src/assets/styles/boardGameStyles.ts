export const textfieldStyles = {
  width: '50%',
  '& .MuiOutlinedInput-root': {
    '& fieldset': {
      borderColor: 'white', // White border color
    },
    '&:hover fieldset': {
      borderColor: 'white', // White border color on hover
    },
    '&.Mui-focused fieldset': {
      borderColor: 'white', // White border color when focused
    },
  },
  '& .MuiInputBase-input': {
    color: 'white', // White text color
  },
  '& .MuiInputLabel-root': {
    color: 'white', // White label color
  },
};

export const selectStyles = {
  width: '100%',
  '& .MuiInputBase-input': {
    color: 'white', // White text color
  },

  '& .MuiSelect-icon': {
    color: 'white', // White icon color
  },

  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: 'white',
    color: 'white',
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: 'white',
  },
};
