import { Box, Typography } from "@mui/material";
import "@fontsource/pacifico";
import cat from "../../../assets/Images/cat.svg";
import cum from "../../../assets/Images/cum.svg";
import fish from "../../../assets/Images/fish.svg";
import skull from "../../../assets/Images/skull.svg";
import ketchup from "../../../assets/Images/ketchup.svg";
import redHat from "../../../assets/Images/redHat.svg";
import foot from "../../../assets/Images/foot.svg";
import astral from "../../../assets/Images/astral.svg";
import blackHeart from "../../../assets/Images/blackHeart.svg";
import greenLootBeam from "../../../assets/Images/greenLootBeam.gif";
import littleTown from "../../../assets/Images/Little_Town.png";

const Home = () => {
  const gangIcons = [
    cat,
    cum,
    fish,
    skull,
    ketchup,
    redHat,
    foot,
    astral,
    blackHeart,
  ];

  return (
    <Box
      sx={{
        backgroundImage: "linear-gradient(to bottom, #2A9D8F, #000000)",
        height: "100%",
        display: "flex",
        justifyContent: "center",
        p: 5,
        alignItems: "center",
        flexDirection: "row",
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "top",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          textAlign: "start",
          pt: 15,
          pl: 2,
        }}
      >
        <Typography
          variant="h1"
          fontSize={36}
          fontFamily={"'pacifico', cursive"}
        >
          Welcome to Little Town!
        </Typography>

        <Box
          sx={{
            display: "flex",
            width: "65%",
            justifyContent: "space-between",
            p: 1,
          }}
        >
          {gangIcons.map((name, index) => (
            <img
              aria-label={"Little Town Gang Logos"}
              key={index}
              width="25"
              height="auto"
              src={name}
            />
          ))}
        </Box>
        <Typography
          variant={"body1"}
          fontSize={18}
          pt={1}
          pl={0.5}
          width={"65%"}
        >
          In this Little Town, we strive to create a welcoming and inclusive
          community for all players. We believe that diversity is what makes our
          clan strong and interesting. We celebrate our differences and
          encourage everyone to be themselves, as we understand that
          individuality is a key ingredient in building a vibrant community!
        </Typography>
      </Box>
      <Box
        sx={{
          width: "40%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          pb: 5,
        }}
      >
        <img
          src={greenLootBeam}
          alt={"Loot Beam"}
          width="150"
          height="auto"
          style={{ transform: "rotate(8deg)" }}
        />
        <img
          src={littleTown}
          alt="Little Town Logo"
          width="60"
          height="60"
          style={{
            borderRadius: "10px",
            transform: "rotate(15deg)",
          }}
        />
      </Box>
    </Box>
  );
};

export default Home;
