const { isBefore, parseISO } = require('date-fns');

const api = require('../services/api');
const clans = require('./clans');

const globalRanking = [];

const AuthStr = 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiIsImtpZCI6IjI4YTMxOGY3LTAwMDAtYTFlYi03ZmExLTJjNzQzM2M2Y2NhNSJ9.eyJpc3MiOiJzdXBlcmNlbGwiLCJhdWQiOiJzdXBlcmNlbGw6Z2FtZWFwaSIsImp0aSI6IjYxMDBmYzU4LWVmZjctNDUwYi1iYjY5LTM0MDQ2MTU2NjZiNCIsImlhdCI6MTU3NTc2OTUzNSwic3ViIjoiZGV2ZWxvcGVyLzYwNjg2YjlhLWQxMTAtMTk5Ny1kYTNkLWRmY2EwYzNkNjAwZSIsInNjb3BlcyI6WyJjbGFzaCJdLCJsaW1pdHMiOlt7InRpZXIiOiJkZXZlbG9wZXIvc2lsdmVyIiwidHlwZSI6InRocm90dGxpbmcifSx7ImNpZHJzIjpbIjQ1LjIzNC4xMDAuMjM5Il0sInR5cGUiOiJjbGllbnQifV19.uafkoRCcXvGDh5QD-6PBb4P80uqz39UpnsEcH83W7DaPVQPRhBUSnu4UZJwiInawuQeCUXV6EHSuUuapUUxSFw'

const getClanWarLeagueInfo = async (clanTag) => {
    const response = await api.get(`/clans/%23${clanTag}/currentwar/leaguegroup`,  { headers: { Authorization: AuthStr } });
    const { rounds } = response.data;
    
    return rounds;
}

const getWarInfo = async(warTag) => {
    const response = await api.get(`/clanwarleagues/wars/%23${warTag}`,  { headers: { Authorization: AuthStr } });
    const { clan, opponent, endTime } = response.data;

    return {clan, opponent, endTime}
}

const checkWinner = (warInfo) => {
      if(warInfo.clanStars > warInfo.opponentStars ) {
        return true;
    } else if(warInfo.opponentStars > warInfo.clanStars) {
        return false;
    } else { // empate em estrelas
        if( warInfo.clanPercentage > warInfo.opponentPercentage){
            return true;
        } else if ( warInfo.opponentPercentage > warInfo.clanPercentage ){
            return false;
        }
    }
}

const sanitizeText = (text) => {
    return text.replace('#','');
}

const filterDays = days => {
    let filteredDays = days;
    days.forEach((day, index) => {
        if(day.warTags[0] === '#0'){
            filteredDays = days.slice(0, index);
        }
    });

    return filteredDays;
}

const alreadyHappened = date => {
    if( isBefore(parseISO(date), new Date()) ){
        return true;
    }
}

const extractDayWarInfo = async wars => {
    const promisedGroupDayWars = wars.map(async warTag => {
        const warTagSanitized = sanitizeText(warTag);
        const response = await getWarInfo(warTagSanitized);

        const { clan, opponent, endTime } = response;

        const { tag: clanTag,  name: clanName, stars: clanStars, destructionPercentage: clanPercentage} = clan;
        const { tag: opponentTag,  name: opponentName, stars: opponentStars, destructionPercentage: opponentPercentage} = opponent;

        return { clanTag, clanName, clanStars, clanPercentage, opponentTag, opponentName, opponentStars, opponentPercentage, endTime };
    })
    const groupDayWars = await Promise.all(promisedGroupDayWars);
    return groupDayWars;
}

const incrementClanStars = allGroupWars => {
    const groupRanking = [];
    allGroupWars.map((day, index) => {
        if(index === 0) {
            for (let i = 0; i < day.length; i++) {
                const element = day[i];

                if(checkWinner(element)) {
                    groupRanking.push({ clanName: element.clanName, clanTag: element.clanTag, stars: element.clanStars + 10, wars: allGroupWars.length })
                    groupRanking.push({ clanName: element.opponentName, clanTag: element.opponentTag, stars: element.opponentStars, wars: allGroupWars.length })
                } else {
                    groupRanking.push({ clanName: element.clanName, clanTag: element.clanTag, stars: element.clanStars, wars: allGroupWars.length })
                    groupRanking.push({ clanName: element.opponentName, clanTag: element.opponentTag, stars: element.opponentStars + 10, wars: allGroupWars.length });    
                }
            }
        } else {
            for (let i = 0; i < day.length; i++) {
                const element = day[i]; // element.clan e element.opponent
                const clan1 = groupRanking.find(clan => clan.clanTag === element.clanTag);
                const clan1Index = groupRanking.findIndex(clan => clan.clanTag === clan1.clanTag)
                
                const clan2 = groupRanking.find(clan => clan.clanTag === element.opponentTag);
                const clan2Index = groupRanking.findIndex(clan => clan.clanTag === clan2.clanTag)

                groupRanking[clan1Index].stars = clan1.stars + element.clanStars;
                groupRanking[clan2Index].stars = clan2.stars + element.opponentStars;
                
                if(checkWinner(element) && alreadyHappened(element.endTime) ) {
                    groupRanking[clan1Index].stars  +=  10;
                } else if(alreadyHappened(element.endTime)){
                    groupRanking[clan2Index].stars += 10;
                }
            }
        }
    })
    return groupRanking;
}

async function main() {
    const myBalls = clans.map( async clan => { // itera por todos os clans da variável global clans
        const days = await getClanWarLeagueInfo(clan.clanTag); // retorna dados de cada dia das guerras de um dado clan
        const filteredDays = filterDays(days); // remove do array os dias cujas guerras ainda nao comecaram
        console.log(filteredDays)
        const promisedGroupWars = filteredDays.map( async day => { 
            const { warTags: wars }= day; // pega apenas um dia especifico

            const groupDayWars = extractDayWarInfo(wars) // retorna informação sobre os 2 clans e sobre o endTime
            return groupDayWars;
        } )
        const groupWars = await Promise.all(promisedGroupWars); // informação sobre todas as guerras do grupo
        const groupRanking = incrementClanStars(groupWars); // faz a contagem de estrelas, e retorna o ranking do grupo

        groupRanking.sort(( a,b ) => a.stars < b.stars); //ordena os clans pelo numero de estrelas
        // console.log(groupRanking);
        globalRanking.push(groupRanking[0]);
    } )
    await Promise.all(myBalls);
    console.log(globalRanking);
} 

main();
