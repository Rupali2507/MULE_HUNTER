const Testimonials = () => {
  const reviews = [
    { name: "Sara T", text: "YourBank has been my trusted financial partner for years. Their personalized service and innovative digital banking solutions have made managing my finances a breeze." },
    { name: "John D", text: "I recently started my own business, and YourBank has been instrumental in helping me set up my business accounts and secure the financing I needed." },
    { name: "Emily G", text: "I love the convenience of YourBank's mobile banking app. It allows me to stay on top of my finances and make transactions on the go with ease." }
  ];

  return (
    <section className="py-20 px-8">
      <div className="flex justify-between items-end mb-12">
        <div>
          <h2 className="text-4xl text-white font-medium">Our <span className="text-[#CAFF33]">Testimonials</span></h2>
          <p className="text-gray-400 mt-2">Discover how YourBank has transformed lives with innovative digital solutions.</p>
        </div>
        <div className="bg-[#1A1A1A] p-1 rounded-full border border-gray-800 flex">
          <button className="bg-[#CAFF33] text-black px-6 py-2 rounded-full text-sm font-medium">For Individuals</button>
          <button className="text-white px-6 py-2 rounded-full text-sm font-medium">For Businesses</button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {reviews.map((rev, i) => (
          <div key={i} className="text-center">
             <div className="text-[#CAFF33] text-5xl mb-4">"</div>
             <p className="text-gray-300 text-sm leading-relaxed mb-6">{rev.text}</p>
             <p className="text-[#CAFF33] font-medium">{rev.name}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Testimonials;